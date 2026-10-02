import base64
import io
import json
import shutil
import subprocess
import time
from pathlib import Path
import pytest
import pymupdf as fitz
from PIL import Image
from convertbox_api.core import ConversionRequest, JobStatus
from convertbox_api.tool_handlers.registry import make_tool_registry
from convertbox_api.jobs import Job, JobManager


def pdf_source(path):
    with fitz.open() as doc:
        for i in range(3):doc.new_page().insert_text((50,80),f'Original {i+1}',fontsize=24)
        doc.save(path)


def test_pdf_proof_matches_export_and_page_preview_is_bounded(tmp_path):
    registry=make_tool_registry();source=tmp_path/'source.pdf';pdf_source(source)
    settings={'text':'CONFIDENTIAL','font_size':24,'rotation':0,'x_percent':20,'y_percent':50,'pages':'2'}
    target=tmp_path/'actual.pdf';registry.get('pdf.watermark').convert(ConversionRequest(source,target,'pdf','pdf',settings))
    report=tmp_path/'proof.json';registry.get('pdf.proof').convert(ConversionRequest(source,report,'pdf','json',{**settings,'page':2,'source_operation':'pdf.watermark'}))
    data=json.loads(report.read_text());assert len(data['pages'])==1 and data['total']==3
    preview=base64.b64decode(data['pages'][0]['thumbnail'].split(',')[1])
    with fitz.open(target) as doc:
        page=doc[1];scale=min(640/page.rect.width,800/page.rect.height)
        assert preview==page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).tobytes('png')


def test_unlock_requires_the_actual_password(tmp_path):
    registry=make_tool_registry();source=tmp_path/'source.pdf';pdf_source(source)
    locked=tmp_path/'locked.pdf';registry.get('pdf.protect').convert(ConversionRequest(source,locked,'pdf','pdf',{'password':'secret'}))
    target=tmp_path/'unlocked.pdf'
    with pytest.raises(ValueError):registry.get('pdf.unlock').convert(ConversionRequest(locked,target,'pdf','pdf',{'password':'wrong'}))
    registry.get('pdf.unlock').convert(ConversionRequest(locked,target,'pdf','pdf',{'password':'secret'}))
    with fitz.open(target) as doc:assert not doc.needs_pass and len(doc)==3


def test_waveform_has_real_peaks_and_media_track_metadata(tmp_path):
    registry=make_tool_registry()
    if not registry.get('audio.waveform').available():pytest.skip('FFmpeg unavailable')
    source=tmp_path/'tone.wav';subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','0.5',str(source)],check=True)
    target=tmp_path/'wave.json';registry.get('audio.waveform').convert(ConversionRequest(source,target,'wav','json',{}))
    data=json.loads(target.read_text());assert .49<data['duration']<.51;assert 1<=len(data['peaks'])<=4096;assert .1<max(data['peaks'])<.2
    registry.get('media.info').convert(ConversionRequest(source,target,'wav','json',{}))
    assert json.loads(target.read_text())['tracks'][0]['codec_type']=='audio'
    registry.get('audio.analyze').convert(ConversionRequest(source,target,'wav','json',{}))
    assert float(json.loads(target.read_text())['integrated_lufs'])<0


def test_processing_cancel_is_cooperative_and_keeps_status(tmp_path):
    manager=JobManager(root=tmp_path/'jobs',workers=1)
    directory=tmp_path/'job';directory.mkdir()
    job=Job(id='cancel-test',directory=directory,inputs=(),input_format='png',output_format='png',output_name='result.png',output_path=directory/'result.png',operation='convert',settings={})
    job.status=JobStatus.PROCESSING;manager.jobs[job.id]=job
    assert manager.delete(job.id) and job.cancel_event.is_set()
    assert manager.get(job.id) is job
    with pytest.raises(ValueError,match='cancelled'):manager._set_progress(job,.1)


def test_ocr_uses_pixels_and_returns_editable_text(tmp_path):
    registry=make_tool_registry()
    if not registry.get('pdf.ocr').available():pytest.skip('Tesseract unavailable')
    raster=tmp_path/'scan.pdf'
    with fitz.open() as doc:
        page=doc.new_page(width=500,height=250);page.insert_text((40,100),'CONVERTBOX SAMPLE',fontsize=35)
        png=page.get_pixmap(dpi=144).tobytes('png')
    with fitz.open() as doc:
        page=doc.new_page(width=500,height=250);page.insert_image(page.rect,stream=png);doc.save(raster)
    target=tmp_path/'ocr.txt';registry.get('pdf.ocr').convert(ConversionRequest(raster,target,'pdf','txt',{'language':'eng'}))
    assert 'CONVERTBOX' in target.read_text().upper()


def test_resize_unlocked_uses_exact_dimensions_and_favicon_layouts_differ(tmp_path):
    from convertbox_api.converters import ImageConverter
    source=tmp_path/'wide.png'
    with Image.new('RGBA',(96,64),(255,0,0,255)) as image:image.save(source)
    target=tmp_path/'resized.png'
    ImageConverter().convert(ConversionRequest(source,target,'png','png',{'width':40,'height':40,'stretch':True}))
    with Image.open(target) as image:assert image.size==(40,40)
    registry=make_tool_registry()
    for mode in ('pad','crop'):
        ico=tmp_path/f'{mode}.ico';registry.get('image.favicon').convert(ConversionRequest(source,ico,'png','ico',{'fit':mode}))
        with Image.open(ico) as image:
            rgba=image.convert('RGBA');assert (rgba.getpixel((0,0))[3]==0)==(mode=='pad')


def test_external_process_cancellation_kills_and_reaps_child(tmp_path):
    import sys
    from convertbox_api.converters import run_process, ConversionError
    started=time.monotonic()
    request=ConversionRequest(tmp_path/'input',tmp_path/'output','txt','txt',{},cancelled=lambda:time.monotonic()-started>.3)
    with pytest.raises(ConversionError) as error:run_process(request,[sys.executable,'-c','import time;time.sleep(10)'],20)
    assert error.value.code=='CANCELLED' and time.monotonic()-started<3


def test_cancel_only_preserves_completed_result_but_delete_removes_it(tmp_path):
    manager = JobManager(root=tmp_path / 'jobs', workers=1)
    directory = tmp_path / 'completed'
    directory.mkdir()
    output = directory / 'result.png'
    output.write_bytes(b'completed result')
    job = Job(id='completed-test', directory=directory, inputs=(), input_format='png', output_format='png', output_name='result.png', output_path=output, operation='convert', settings={})
    job.status = JobStatus.COMPLETED
    manager.jobs[job.id] = job
    assert manager.delete(job.id, cancel_only=True)
    assert manager.get(job.id) is job
    assert output.read_bytes() == b'completed result'
    assert not job.cancel_event.is_set()
    assert manager.delete(job.id)
    assert manager.get(job.id) is None
    assert not directory.exists()
