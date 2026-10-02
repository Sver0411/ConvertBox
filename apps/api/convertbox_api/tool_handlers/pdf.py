import base64
import json
import shutil
import os
import subprocess
import tempfile
from pathlib import Path
from contextlib import contextmanager
from zipfile import ZipFile, ZIP_DEFLATED
import pymupdf as fitz
from ..core import ConversionRequest
from ..converters import ConversionError, _pages, _int_setting, run_process
from ..config import MAX_OUTPUT_SIZE
from .images import write_report
from .registry import ToolHandler

@contextmanager
def open_pdf(request):
    with fitz.open(request.input_path) as document:
        if document.needs_pass:
            raise ConversionError('Encrypted PDF requires unlocking first', 'INVALID_FILE')
        if not 0 < len(document) <= 200:
            raise ConversionError('PDF must contain 1–200 pages', 'PDF_PAGE_LIMIT')
        yield document

def save(document, request):
    if not len(document): raise ConversionError('At least one page must remain', 'INVALID_SETTINGS')
    document.save(request.output_path, garbage=4, deflate=True)

def organize(request):
    with open_pdf(request) as source, fitz.open() as result:
        try:
            pages=json.loads(str(request.settings.get('page_order','[]')))
            if not isinstance(pages,list) or not 0<len(pages)<=200: raise ValueError()
            for item in pages:
                page=int(item['page']); rotation=int(item.get('rotation',0))
                if not 0<=page<len(source) or rotation not in (0,90,180,270): raise ValueError()
                result.insert_pdf(source,from_page=page,to_page=page)
                result[-1].set_rotation((source[page].rotation+rotation)%360)
        except (ValueError,TypeError,KeyError) as exc: raise ConversionError('Invalid page order','INVALID_SETTINGS') from exc
        save(result,request)

def select_pages(request):
    with open_pdf(request) as source, fitz.open() as result:
        selected=_pages(str(request.settings.get('pages','all')),len(source))
        if request.operation=='pdf.delete-pages': selected=[i for i in range(len(source)) if i not in selected]
        for index in selected: result.insert_pdf(source,from_page=index,to_page=index)
        save(result,request)

def preview(request):
    with open_pdf(request) as source:
        wanted=_int_setting(request,'page',0,0,200)
        indices=[wanted-1] if wanted else range(len(source))
        if wanted>len(source):raise ConversionError('Page is outside PDF','INVALID_SETTINGS')
        pages=[]
        for index in indices:
            page=source[index];scale=min((640 if wanted else 160)/page.rect.width,(800 if wanted else 200)/page.rect.height)
            pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
            pages.append({'page':index,'width':page.rect.width,'height':page.rect.height,'thumbnail':'data:image/png;base64,'+base64.b64encode(pix.tobytes('png')).decode()})
        write_report(request,{'pages':pages,'total':len(source),'selectable_text':any(source[i].get_text().strip() for i in range(min(len(source),10)))})


def watermark(request):
    text=str(request.settings.get('text','')).strip()
    if not text or len(text)>200: raise ConversionError('Watermark must contain 1–200 characters','INVALID_SETTINGS')
    size=_int_setting(request,'font_size',36,8,120)
    try:
        opacity=float(request.settings.get('opacity',.2));rotation=float(request.settings.get('rotation',45))
        if not 0<opacity<=1 or not -180<=rotation<=180: raise ValueError()
    except (TypeError,ValueError) as exc: raise ConversionError('Invalid opacity or rotation','INVALID_SETTINGS') from exc
    position=str(request.settings.get('position','center'))
    if position not in ('center','top-left','top-right','bottom-left','bottom-right'): raise ConversionError('Invalid position','INVALID_SETTINGS')
    with open_pdf(request) as source:
        font='china-s' if any(ord(c)>255 for c in text) else 'helv'
        for index in _pages(str(request.settings.get('pages','all')),len(source)):
            page=source[index];r=page.rect
            width=fitz.get_text_length(text,fontname=font,fontsize=size)
            x=(r.width-width)/2 if position=='center' else 24 if position.endswith('left') else r.width-width-24
            y=r.height/2 if position=='center' else size+24 if position.startswith('top') else r.height-24
            x=float(request.settings.get('x_percent',x/r.width*100))/100*r.width if 'x_percent' in request.settings else x
            y=float(request.settings.get('y_percent',y/r.height*100))/100*r.height if 'y_percent' in request.settings else y
            if not 0<=x<=r.width or not 0<=y<=r.height:raise ConversionError('Watermark position is outside page','INVALID_SETTINGS')
            point=fitz.Point(max(0,x),y)
            page.insert_text(point,text,fontname=font,fontsize=size,color=(.35,.35,.35),fill_opacity=opacity,morph=(point,fitz.Matrix(rotation)))
        save(source,request)

def page_numbers(request):
    size=_int_setting(request,'font_size',12,6,72);margin=_int_setting(request,'margin',24,0,100);start=_int_setting(request,'start',1,0,100000)
    position=str(request.settings.get('position','bottom-center'));pattern=str(request.settings.get('format','{n} / {total}'))
    if position not in ('bottom-left','bottom-center','bottom-right','top-center') or pattern not in ('{n} / {total}','Page {n}','{n}'): raise ConversionError('Invalid page number settings','INVALID_SETTINGS')
    with open_pdf(request) as source:
        for offset,index in enumerate(_pages(str(request.settings.get('pages','all')),len(source))):
            page=source[index];text=pattern.format(n=start+offset,total=len(source));width=fitz.get_text_length(text,fontsize=size)
            x=margin if position.endswith('left') else page.rect.width-width-margin if position.endswith('right') else (page.rect.width-width)/2
            y=margin+size if position.startswith('top') else page.rect.height-margin
            page.insert_text((x,y),text,fontsize=size)
        save(source,request)

def extract_images(request):
    with open_pdf(request) as source, ZipFile(request.output_path,'w',ZIP_DEFLATED) as archive:
        seen=set();total=0;manifest=[]
        for page_index,page in enumerate(source):
            for image in page.get_images():
                xref=image[0]
                if xref in seen:
                    for item in manifest:
                        if item['xref']==xref:item['pages'].append(page_index+1)
                    continue
                seen.add(xref)
                if len(seen)>1000: raise ConversionError('Too many embedded images','OUTPUT_TOO_LARGE')
                data=source.extract_image(xref)
                if not data: continue
                total+=len(data['image'])
                if total>MAX_OUTPUT_SIZE: raise ConversionError('Embedded images exceed output limit','OUTPUT_TOO_LARGE')
                name=f'image_{xref}.{data["ext"]}'
                archive.writestr(name,data['image'])
                manifest.append({'name':name,'xref':xref,'pages':[page_index+1],'width':data['width'],'height':data['height']})
        archive.writestr('images.json',json.dumps(manifest,ensure_ascii=False))
        if not seen: raise ConversionError('PDF contains no embedded images','INVALID_FILE')

def metadata(request):
    with fitz.open(request.input_path) as source:
        if request.settings.get('remove') is True:
            if source.needs_pass: raise ConversionError('Encrypted PDF cannot be edited','INVALID_FILE')
            source.set_metadata({});source.del_xml_metadata();save(source,request)
        else: write_report(request,{**{k:v for k,v in source.metadata.items() if v},'pages':len(source),'encrypted':source.is_encrypted})

def protect(request):
    password=str(request.settings.get('password',''))
    if not 1<=len(password.encode())<=127: raise ConversionError('Password must contain 1–127 UTF-8 bytes','INVALID_SETTINGS')
    with open_pdf(request) as source:
        source.save(request.output_path,encryption=fitz.PDF_ENCRYPT_AES_256,user_pw=password,owner_pw=password,permissions=fitz.PDF_PERM_PRINT|fitz.PDF_PERM_COPY,garbage=4,deflate=True)


def proof(request):
    from dataclasses import replace
    operation=str(request.settings.get('source_operation',''))
    if operation not in ('pdf.watermark','pdf.page-numbers'):raise ConversionError('Unsupported proof operation','INVALID_SETTINGS')
    page_number=_int_setting(request,'page',1,1,200)
    with tempfile.TemporaryDirectory(dir=request.output_path.parent) as directory:
        path=Path(directory)/'proof.pdf'
        # Use the same renderer and settings as the export, not a browser font approximation.
        preview_request=replace(request,output_path=path,output_format='pdf')
        (watermark if operation=='pdf.watermark' else page_numbers)(preview_request)
        preview(replace(request,input_path=path,settings={'page':page_number}))

def unlock(request):
    with fitz.open(request.input_path) as source:
        if source.needs_pass and not source.authenticate(str(request.settings.get('password',''))):
            raise ConversionError('Incorrect PDF password','INVALID_SETTINGS')
        if not 0<len(source)<=200:raise ConversionError('PDF page limit exceeded','PDF_PAGE_LIMIT')
        source.save(request.output_path,encryption=fitz.PDF_ENCRYPT_NONE,garbage=4,deflate=True)

def ocr(request):
    lang=str(request.settings.get('language','eng'))
    if lang not in ('eng','chi_sim','chi_sim+eng'):raise ConversionError('Unsupported OCR language','INVALID_SETTINGS')
    with open_pdf(request) as source:
        selected=_pages(str(request.settings.get('pages','all')),len(source))
        if len(selected)>20:raise ConversionError('OCR accepts at most 20 pages','PDF_PAGE_LIMIT')
        texts=[]
        with tempfile.TemporaryDirectory(dir=request.output_path.parent) as folder:
            for offset,index in enumerate(selected):
                page=source[index]
                if page.rect.width*page.rect.height*(144/72)**2>20_000_000:raise ConversionError('OCR page is too large','PDF_PAGE_LIMIT')
                path=Path(folder)/'page.png';page.get_pixmap(dpi=144,alpha=False).save(path)
                try:
                    models=Path(os.environ.get('CONVERTBOX_TESSDATA',str(Path(__file__).resolve().parents[2]/'.ocr-data')))
                    args=['tesseract',str(path),'stdout','-l',lang]
                    if models.is_dir():args+=['--tessdata-dir',str(models)]
                    done=run_process(request,args,60)
                except subprocess.SubprocessError as exc:raise ConversionError('OCR failed; check installed language data','CONVERTER_UNAVAILABLE') from exc
                texts.append(done.stdout.strip());path.unlink()
                if request.on_progress:request.on_progress((offset+1)/len(selected))
        if request.output_format=='txt':request.output_path.write_text('\n\n'.join(texts),encoding='utf-8')
        else:
            from docx import Document
            document=Document()
            for text in texts:
                document.add_paragraph(text)
            document.save(request.output_path)

def register_pdf(registry):
    registry.register(ToolHandler('pdf.proof',('pdf',),('json',),proof,frozenset({'source_operation','page','text','font_size','opacity','rotation','position','pages','start','margin','format','x_percent','y_percent'})))
    registry.register(ToolHandler('pdf.unlock',('pdf',),('pdf',),unlock,frozenset({'password'})))
    registry.register(ToolHandler('pdf.ocr',('pdf',),('txt','docx'),ocr,frozenset({'pages','language'}),available=lambda:bool(shutil.which('tesseract'))))
    entries=[('organize',organize,('pdf',),{'page_order'}),('extract-pages',select_pages,('pdf',),{'pages'}),('delete-pages',select_pages,('pdf',),{'pages'}),('watermark',watermark,('pdf',),{'text','font_size','opacity','rotation','position','pages','x_percent','y_percent'}),('page-numbers',page_numbers,('pdf',),{'start','position','font_size','margin','pages','format'}),('extract-images',extract_images,('zip',),set()),('metadata',metadata,('json','pdf'),{'remove'}),('protect',protect,('pdf',),{'password'}),('preview',preview,('json',),{'page'})]
    for slug,handler,outputs,settings in entries: registry.register(ToolHandler('pdf.'+slug,('pdf',),outputs,handler,frozenset(settings)))
