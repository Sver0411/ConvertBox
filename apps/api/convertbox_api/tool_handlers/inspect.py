import json
import mimetypes
import subprocess
from zipfile import ZipFile
import pymupdf
from PIL import Image
from ..capabilities import IMAGE_INPUTS, AUDIO_INPUTS, VIDEO_INPUTS
from .images import write_report
from .registry import ToolHandler

def inspect_file(request):
    path=request.input_path
    with path.open('rb') as stream: magic=stream.read(32).hex(' ')
    fields={'actual_format':request.input_format,'size':path.stat().st_size,'mime':mimetypes.guess_type('file.'+request.input_format)[0] or 'application/octet-stream','magic_signature':magic}
    if request.input_format in IMAGE_INPUTS and request.input_format!='svg':
        with Image.open(path) as image:
            fields.update(width=image.width,height=image.height,pixels=image.width*image.height,color_mode=image.mode,alpha='A' in image.getbands(),frames=getattr(image,'n_frames',1),animated=getattr(image,'is_animated',False))
            if image.info.get('icc_profile'):fields['icc_bytes']=len(image.info['icc_profile'])
            if image.getexif():fields['exif']={str(key):str(value)[:1024] for key,value in image.getexif().items()}
    elif request.input_format=='pdf':
        with pymupdf.open(path) as document:
            fields.update(pages=len(document),encrypted=document.is_encrypted,metadata=document.metadata)
            if not document.needs_pass and len(document)<=200:
                fields['images']=len({image[0] for page in document for image in page.get_images()})
                fields['fonts']=len({font[0] for page in document for font in page.get_fonts()})
    elif request.input_format in AUDIO_INPUTS+VIDEO_INPUTS:
        result=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,check=True,timeout=15)
        data=json.loads(result.stdout)
        fields['container']={key:value for key,value in data.get('format',{}).items() if key in ('format_name','duration','bit_rate')}
        fields['streams']=[{key:value for key,value in stream.items() if key in ('codec_type','codec_name','width','height','r_frame_rate','sample_rate','channels','bit_rate','duration')} for stream in data.get('streams',[])[:16]]
    elif request.input_format=='zip':
        with ZipFile(path) as archive:
            infos=archive.infolist();fields.update(entries=len(infos),uncompressed_bytes=sum(item.file_size for item in infos))
            fields['files']=[{'name':item.filename,'size':item.file_size} for item in infos[:1000]]
    write_report(request,fields)

def register_inspect(registry): registry.register(ToolHandler('file.inspect',('*',),('json',),inspect_file,allow_animation=True))
