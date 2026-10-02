import json
from pathlib import Path
import pytest
from PIL import Image
from convertbox_api.core import ConversionRequest
from convertbox_api.tool_handlers.registry import make_tool_registry
from convertbox_api.svg import validate_svg
from convertbox_api.detection import detect_file

@pytest.mark.parametrize('tool,settings,size', [('image.compress',{'quality':70},(20,10)),('image.rotate',{'rotation':90},(10,20)),('image.flip',{'direction':'horizontal'},(20,10)),('image.strip-metadata',{},(20,10))])
def test_image_tools(tmp_path: Path, tool, settings, size):
    source=tmp_path/'source.jpg';target=tmp_path/'result.png'
    exif=Image.Exif();exif[270]='private';Image.new('RGB',(20,10),'red').save(source,exif=exif)
    make_tool_registry().get(tool).convert(ConversionRequest(source,target,'jpg','png',settings))
    with Image.open(target) as result:
        assert result.size==size
        if tool=='image.strip-metadata': assert not result.getexif()

def test_metadata_favicon_tiff(tmp_path: Path):
    source=tmp_path/'source.tiff';Image.new('RGB',(20,10)).save(source)
    assert detect_file(source,source.name)=='tiff'
    registry=make_tool_registry();target=tmp_path/'report.json'
    registry.get('image.metadata').convert(ConversionRequest(source,target,'tiff','json',{}))
    assert json.loads(target.read_text())['width']==20
    png=tmp_path/'source.png';Image.new('RGBA',(300,300)).save(png)
    ico=tmp_path/'favicon.ico';registry.get('image.favicon').convert(ConversionRequest(png,ico,'png','ico',{}))
    with Image.open(ico) as image: assert image.ico.sizes()=={(v,v) for v in (16,32,48,64,128,256)}

@pytest.mark.parametrize('body',['<script/>','<foreignObject/>','<image href="https://example.com/a"/>','<use href="file:///etc/passwd"/>','<rect style="fill:url(https://example.com/a)"/>','<text font-family="external">x</text>'])
def test_svg_rejects_resources(body):
    with pytest.raises(ValueError): validate_svg(f'<svg xmlns="http://www.w3.org/2000/svg">{body}</svg>'.encode())

def test_svg_safe_and_xxe():
    validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>')
    with pytest.raises(Exception): validate_svg(b'<!DOCTYPE svg [<!ENTITY a SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>')

@pytest.mark.parametrize('tool,settings,pages', [('pdf.organize',{'page_order':'[{"page":2,"rotation":90},{"page":0}]'},2),('pdf.extract-pages',{'pages':'1,3'},2),('pdf.delete-pages',{'pages':'2'},2),('pdf.watermark',{'text':'CONFIDENTIAL'},3),('pdf.page-numbers',{},3),('pdf.protect',{'password':'secret'},3)])
def test_pdf_tools(tmp_path,tool,settings,pages):
    import pymupdf
    source=tmp_path/'source.pdf';target=tmp_path/'result.pdf'
    with pymupdf.open() as document:
        for index in range(3): document.new_page().insert_text((50,50),f'Original {index+1}')
        document.save(source)
    registry=make_tool_registry();registry.get(tool).convert(ConversionRequest(source,target,'pdf','pdf',settings,operation=tool))
    with pymupdf.open(target) as result:
        if tool=='pdf.protect': assert result.needs_pass and result.authenticate('secret')
        assert len(result)==pages
        if tool=='pdf.organize': assert 'Original 3' in result[0].get_text() and result[0].rotation==90
        if tool=='pdf.watermark': assert 'CONFIDENTIAL' in result[0].get_text()
        if tool=='pdf.page-numbers': assert '1 / 3' in result[0].get_text()

def test_pdf_embedded_metadata_preview(tmp_path):
    import pymupdf
    import io
    from zipfile import ZipFile
    png=io.BytesIO();Image.new('RGB',(10,20),'blue').save(png,'PNG')
    source=tmp_path/'source.pdf'
    with pymupdf.open() as document:
        page=document.new_page();page.insert_image((50,50,100,150),stream=png.getvalue());document.set_metadata({'title':'Private'});document.save(source)
    registry=make_tool_registry()
    target=tmp_path/'images.zip';registry.get('pdf.extract-images').convert(ConversionRequest(source,target,'pdf','zip',{}))
    with ZipFile(target) as archive:
        with Image.open(io.BytesIO(archive.read(archive.namelist()[0]))) as image: assert image.size==(10,20)
    target=tmp_path/'preview.json';registry.get('pdf.preview').convert(ConversionRequest(source,target,'pdf','json',{}))
    assert json.loads(target.read_text())['pages'][0]['thumbnail'].startswith('data:image/png;base64,')
    target=tmp_path/'clean.pdf';registry.get('pdf.metadata').convert(ConversionRequest(source,target,'pdf','pdf',{'remove':True}))
    with pymupdf.open(target) as document: assert not document.metadata['title']

@pytest.mark.parametrize('tool,settings,output', [('audio.trim',{'start':.2,'end':.8},'wav'),('audio.normalize',{'preset':'podcast'},'wav'),('video.compress',{'preset':'balanced'},'mp4'),('video.trim',{'start':.2,'end':.8},'mp4'),('video.gif',{'duration':1,'width':64,'fps':5},'gif'),('video.frames',{'mode':'even','count':2},'zip')])
def test_media_tools(tmp_path,tool,settings,output):
    import shutil
    import subprocess
    from zipfile import ZipFile
    from convertbox_api.converters import MediaConverter
    registry=make_tool_registry();handler=registry.get(tool)
    if not handler.available(): pytest.skip('Required FFmpeg encoders unavailable')
    video=tool.startswith('video.');source=tmp_path/('source.mp4' if video else 'source.wav')
    args=['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc=size=64x48:rate=10' if video else 'sine=frequency=440:sample_rate=48000','-t','1']
    if video: args+=['-pix_fmt','yuv420p','-c:v','libx264']
    subprocess.run([*args,str(source)],check=True,capture_output=True)
    target=tmp_path/('result.'+output);handler.convert(ConversionRequest(source,target,'mp4' if video else 'wav',output,settings,operation=tool))
    if tool.endswith('trim'): assert .5<MediaConverter._duration(target)<.8
    elif output=='gif':
        with Image.open(target) as image: assert image.width==64 and image.n_frames==5
    elif output=='zip':
        with ZipFile(target) as archive: assert len(archive.namelist())==2
    elif video: assert MediaConverter._video_dimensions(target)==(64,48)
    else: assert .9<MediaConverter._duration(target)<1.2

def test_audio_merge_and_inspect(tmp_path):
    import subprocess
    from convertbox_api.converters import MediaConverter
    registry=make_tool_registry();source=tmp_path/'one.wav'
    if not registry.get('audio.merge').available(): pytest.skip('FFmpeg unavailable')
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=440','-t','0.5',str(source)],check=True)
    target=tmp_path/'merged.wav';registry.get('audio.merge').convert(ConversionRequest(source,target,'wav','wav',{},input_paths=(source,source)))
    assert .9<MediaConverter._duration(target)<1.1
    report=tmp_path/'report.json';registry.get('file.inspect').convert(ConversionRequest(target,report,'wav','json',{}))
    assert json.loads(report.read_text())['streams'][0]['codec_name']=='pcm_s16le'

def test_svg_rasterization_if_available(tmp_path):
    from convertbox_api.svg import available,rasterize
    if not available(): pytest.skip('Cairo system library unavailable')
    source=tmp_path/'source.svg';source.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>')
    target=tmp_path/'result.png';rasterize(source,target)
    with Image.open(target) as image: assert image.size==(20,10) and image.getpixel((5,5))[:3]==(255,0,0)
