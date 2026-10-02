import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
from ..core import ConversionRequest
from ..converters import ConversionError, MediaConverter, _int_setting
from ..capabilities import AUDIO_INPUTS, VIDEO_INPUTS, available_encoders
from ..config import MAX_OUTPUT_SIZE
from .registry import ToolHandler


def seconds(value):
    try:
        parts=str(value).split(':')
        if len(parts)>3: raise ValueError()
        result=0.0
        for part in parts: result=result*60+float(part)
        if not math.isfinite(result) or result<0: raise ValueError()
        return result
    except (ValueError,TypeError) as exc: raise ConversionError('Invalid timestamp','INVALID_SETTINGS') from exc

def duration(path):
    value=MediaConverter._duration(path)
    if not 0<value<=3600: raise ConversionError('Media must have a known duration of at most one hour','INVALID_FILE')
    return value

def bounds(request):
    length=duration(request.input_path);start=seconds(request.settings.get('start',0));end=seconds(request.settings.get('end',length))
    if not start<end<=length+.05: raise ConversionError('Trim range must be within media duration','INVALID_SETTINGS')
    return start,end-start

def run(request,args):
    command=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-threads','2','-filter_threads','1','-filter_complex_threads','1','-y',*args,'-fs',str(MAX_OUTPUT_SIZE),str(request.output_path)]
    try: subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=600,check=True)
    except (OSError,subprocess.SubprocessError) as exc: raise ConversionError('Media tool failed or timed out','CONVERSION_FAILED') from exc
    if request.output_path.stat().st_size>=MAX_OUTPUT_SIZE: raise ConversionError('Output exceeds server limit','OUTPUT_TOO_LARGE')
    if request.on_progress: request.on_progress(.99)

def audio_codec(output):
    return ['-c:a','pcm_s16le'] if output=='wav' else ['-c:a','libmp3lame','-b:a','192k']

def trim(request):
    start,length=bounds(request)
    args=['-ss',str(start),'-i',str(request.input_path),'-t',str(length)]
    if request.input_format in AUDIO_INPUTS: args+=['-vn',*audio_codec(request.output_format)]
    else: args+=['-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-c:a','aac']
    run(request,args)

def merge(request):
    paths=request.input_paths
    if not 2<=len(paths)<=20: raise ConversionError('Merge accepts 2–20 audio files','INVALID_SETTINGS')
    if sum(duration(path) for path in paths)>3600: raise ConversionError('Merged audio exceeds one hour','INVALID_SETTINGS')
    args=[]
    for path in paths: args+=['-i',str(path)]
    filters=';'.join(f'[{i}:a:0]aformat=sample_rates=48000:channel_layouts=stereo[a{i}]' for i in range(len(paths)))
    filters+=';'+''.join(f'[a{i}]' for i in range(len(paths)))+f'concat=n={len(paths)}:v=0:a=1[out]'
    run(request,[*args,'-filter_complex',filters,'-map','[out]',*audio_codec(request.output_format)])

def normalize(request):
    duration(request.input_path)
    preset=str(request.settings.get('preset','general'))
    values={'podcast':(-16,-1.5,11),'music':(-14,-1,9),'general':(-16,-1,11)}
    if preset not in values: raise ConversionError('Invalid normalization preset','INVALID_SETTINGS')
    loudness,peak,range_=values[preset]
    run(request,['-i',str(request.input_path),'-vn','-af',f'loudnorm=I={loudness}:TP={peak}:LRA={range_}',*audio_codec(request.output_format)])

def compress(request):
    duration(request.input_path)
    preset=str(request.settings.get('preset','balanced'))
    values={'light':(23,1080),'balanced':(28,720),'strong':(34,480)}
    if preset not in values: raise ConversionError('Invalid compression preset','INVALID_SETTINGS')
    crf,height=values[preset];dimensions=MediaConverter._video_dimensions(request.input_path)
    if not dimensions or dimensions[0]*dimensions[1]>80_000_000: raise ConversionError('Invalid video dimensions','INVALID_FILE')
    actual_height=min(height,dimensions[1])//2*2
    width=max(2,round(dimensions[0]*actual_height/dimensions[1]/2)*2)
    run(request,['-i',str(request.input_path),'-vf',f'scale={width}:{actual_height}','-c:v','libx264','-preset','medium','-crf',str(crf),'-pix_fmt','yuv420p','-c:a','aac'])

def gif(request):
    length=duration(request.input_path);start=seconds(request.settings.get('start',0));clip=seconds(request.settings.get('duration',5))
    width=_int_setting(request,'width',480,64,800);fps=_int_setting(request,'fps',12,1,20)
    if not 0<clip<=15 or start+clip>length+.05: raise ConversionError('GIF duration must be 1–15 seconds within the video','INVALID_SETTINGS')
    quality=str(request.settings.get('quality','balanced'))
    colors={'light':128,'balanced':192,'high':256}.get(quality)
    if not colors: raise ConversionError('Invalid GIF quality','INVALID_SETTINGS')
    filters=f'fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors={colors}[p];[b][p]paletteuse'
    run(request,['-ss',str(start),'-t',str(clip),'-i',str(request.input_path),'-filter_complex',filters,'-loop','0'])

def frames(request):
    length=duration(request.input_path);mode=str(request.settings.get('mode','even'));count=_int_setting(request,'count',10,1,100)
    if mode=='single': times=[seconds(request.settings.get('start',0))]
    elif mode=='even': times=[length*(i+.5)/count for i in range(count)]
    elif mode=='interval':
        interval=seconds(request.settings.get('interval',5))
        if interval<=0: raise ConversionError('Interval must be positive','INVALID_SETTINGS')
        if math.ceil(length/interval)>100: raise ConversionError('At most 100 frames may be extracted','INVALID_SETTINGS')
        times=[i*interval for i in range(math.ceil(length/interval))]
    else: raise ConversionError('Invalid frame mode','INVALID_SETTINGS')
    if any(at>=length for at in times): raise ConversionError('Frame timestamp is outside video','INVALID_SETTINGS')
    format_=str(request.settings.get('image_format','jpg'))
    if format_ not in ('jpg','png','webp'): raise ConversionError('Invalid frame format','INVALID_SETTINGS')
    total=0
    with tempfile.TemporaryDirectory(dir=request.output_path.parent) as folder, ZipFile(request.output_path,'w',ZIP_STORED) as archive:
        for index,at in enumerate(times):
            target=Path(folder)/f'frame_{index+1:03}.{format_}'
            frame_request=ConversionRequest(request.input_path,target,request.input_format,format_,{})
            run(frame_request,['-ss',str(at),'-i',str(request.input_path),'-frames:v','1','-vf',"scale='min(1920,iw)':-2"])
            total+=target.stat().st_size
            if total>MAX_OUTPUT_SIZE: raise ConversionError('Frames exceed output limit','OUTPUT_TOO_LARGE')
            archive.write(target,target.name);target.unlink()
            if request.on_progress: request.on_progress((index+1)/len(times))

def ready(*encoders):
    return lambda: bool(shutil.which('ffmpeg') and shutil.which('ffprobe') and set(encoders)<=available_encoders())

def register_media(registry):
    for slug,handler,settings in [('trim',trim,{'start','end'}),('merge',merge,set()),('normalize',normalize,{'preset'})]:
        registry.register(ToolHandler('audio.'+slug,AUDIO_INPUTS,('mp3','wav'),handler,frozenset(settings),multiple=slug=='merge',minimum_inputs=2 if slug=='merge' else 1,available=ready('libmp3lame','pcm_s16le')))
    for slug,handler,outputs,settings in [('compress',compress,('mp4',),{'preset'}),('trim',trim,('mp4',),{'start','end'}),('gif',gif,('gif',),{'start','duration','width','fps','quality'}),('frames',frames,('zip',),{'mode','count','start','interval','image_format'})]:
        encoders=('gif',) if slug=='gif' else ('mjpeg','png','libwebp') if slug=='frames' else ('libx264','aac')
        registry.register(ToolHandler('video.'+slug,VIDEO_INPUTS,outputs,handler,frozenset(settings),available=ready(*encoders)))
