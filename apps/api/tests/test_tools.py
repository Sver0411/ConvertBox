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
