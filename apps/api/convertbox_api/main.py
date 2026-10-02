"""HTTP boundary: streamed upload, background jobs and result retrieval."""

from __future__ import annotations

import json
import os
import re
import shutil
import mimetypes
import asyncio
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, UploadFile, Request
from fastapi.responses import FileResponse, JSONResponse

from .capabilities import PDF_OPERATIONS, can_convert, server_capabilities
from .converters import ConversionError
from .core import JobStatus
from .detection import InvalidFile, detect_file
from .jobs import Job, JobManager
from .admission import UploadAdmission, check_storage
from .config import MAX_UPLOAD_SIZE
from .errors import ApiError

manager = JobManager(workers=int(os.environ.get("MAX_CONCURRENT_JOBS", "2")))
admission = UploadAdmission()


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.start()
    yield
    manager.stop()


app = FastAPI(title="ConvertBox API", version="0.2.0", lifespan=lifespan)


@app.middleware("http")
async def admit_upload(request: Request, call_next):
    if request.method != "POST" or request.url.path != "/jobs":
        return await call_next(request)
    try:
        admission.check_rate(request.client.host if request.client else "unknown")
        async with admission.slot():
            await asyncio.to_thread(check_storage, manager.root)
            return await call_next(request)
    except ApiError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers={"Retry-After":"60"} if exc.status_code==429 else {})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    try:
        check_storage(manager.root)
        with tempfile.TemporaryFile(dir=manager.root):
            pass
    except (ApiError, OSError) as exc:
        raise ApiError(503, "NOT_READY", "Server storage is unavailable.") from exc
    workers = [thread for thread in manager.threads if thread.name.startswith("convertbox-worker-")]
    if len(workers) != manager.worker_count or not all(thread.is_alive() for thread in workers):
        raise ApiError(503, "NOT_READY", "Conversion workers are unavailable.")
    return {"status": "ready"}


@app.get("/capabilities")
def capabilities() -> dict[str, object]:
    return {
        "version": 3,
        "tools": manager.tool_registry.capabilities(),
        "server": [item.__dict__ for item in server_capabilities()],
        "pdfOperations": list(PDF_OPERATIONS) + ["compress"],
        "maxUploadSize": MAX_UPLOAD_SIZE,
    }


def _safe_stem(filename: str) -> str:
    leaf = filename.replace("\\", "/").split("/")[-1]
    stem = Path(leaf).stem
    stem = re.sub(r'[\x00-\x1f\x7f<>:"/\\|?*]', "_", stem).strip(" .")
    return stem[:100] or "converted"


@app.post("/jobs", status_code=202)
async def create_job(
    files: Annotated[list[UploadFile], File()],
    output: Annotated[str, Form()],
    operation: Annotated[str, Form()] = "convert",
    settings: Annotated[str, Form()] = "{}",
    tool_id: Annotated[str, Form(alias="toolId")] = "",
) -> dict[str, object]:
    if not files or len(files) > 100:
        raise ApiError(400, "INVALID_FILE", "Upload 1–100 files.")
    tool = manager.tool_registry.get(tool_id) if tool_id else None
    if tool_id and (tool is None or not tool.available()):
        raise ApiError(400, "CONVERTER_UNAVAILABLE", "Tool is unavailable on this server.")
    try:
        parsed = json.loads(settings)
        if not isinstance(parsed, dict) or len(settings) > (16384 if tool else 4096):
            raise ValueError()
        allowed = {"quality", "width", "height", "pages", "dpi", "rotation", "bitrate", "sample_rate", "resolution", "fps", "video_quality", "page_size", "orientation", "margin", "keep_metadata", "audio_track", "channels", "background", "stretch"}
        if tool:
            allowed = tool.settings
        parsed = {key: value for key, value in parsed.items() if key in allowed and isinstance(value, (str, int, float, bool))}
    except (ValueError, TypeError) as exc:
        raise ApiError(400, "INVALID_SETTINGS", "Invalid conversion settings.") from exc
    if not tool and operation not in ("convert", *PDF_OPERATIONS, "compress"):
        raise ApiError(400, "UNSUPPORTED_FORMAT", "Unsupported operation.")
    job_id, directory = await asyncio.to_thread(manager.allocate)
    paths: list[Path] = []
    detected: list[str] = []
    try:
        total = 0
        for index, upload in enumerate(files):
            raw = directory / f"upload_{index}.bin"
            with raw.open("wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_UPLOAD_SIZE:
                        raise ApiError(413, "FILE_TOO_LARGE", "Upload exceeds server limit.")
                    await asyncio.to_thread(check_storage, manager.root)
                    await asyncio.to_thread(target.write, chunk)
            if tool and tool.id == "file.inspect":
                try:
                    kind = await asyncio.to_thread(detect_file, raw, upload.filename or "", allow_animation=True)
                except InvalidFile:
                    try:
                        kind = await asyncio.to_thread(detect_file, raw, "", allow_animation=True)
                    except InvalidFile:
                        kind = "unknown"
            else:
                kind = await asyncio.to_thread(detect_file, raw, upload.filename or "", allow_animation=True) if tool and tool.allow_animation else await asyncio.to_thread(detect_file, raw, upload.filename or "")
            named = directory / f"input_{index}.{kind}"
            await asyncio.to_thread(raw.rename, named)
            paths.append(named)
            detected.append(kind)
            await upload.close()
        source = detected[0]
        if tool:
            if any(kind not in tool.inputs for kind in detected) and "*" not in tool.inputs:
                raise ApiError(400, "UNSUPPORTED_FORMAT", "File format is not accepted by this tool.")
            from .core import ConversionRequest
            tool.validate(ConversionRequest(paths[0], directory / "result", source, output, parsed, input_paths=tuple(paths)))
            operation = tool.id
        elif operation != "convert":
            if source != "pdf" or any(kind != "pdf" for kind in detected):
                raise ApiError(400, "INVALID_FILE", "PDF operation requires PDF inputs.")
            if operation == "merge" and len(paths) < 2:
                raise ApiError(400, "INVALID_FILE", "Merge requires at least two PDFs.")
            if operation != "merge" and len(paths) != 1:
                raise ApiError(400, "INVALID_FILE", "This PDF operation accepts one file.")
            output = "pdf"
        elif len(paths) > 1:
            if output != "pdf" or any(kind not in ("jpg", "png", "webp", "bmp", "gif", "heic", "avif") for kind in detected):
                raise ApiError(400, "INVALID_FILE", "Multiple files are supported for images to PDF.")
        if not tool and not can_convert(source, output) and not (source == "pdf" and output == "pdf" and operation != "convert"):
            raise ApiError(400, "UNSUPPORTED_FORMAT", "Conversion is not supported.")
        extension = output if tool else "zip" if (source == "pdf" and output in ("png", "jpg")) or operation == "split" else output
        base = "merged" if operation == "merge" else "split" if operation == "split" else "images" if len(paths) > 1 and output == "pdf" else _safe_stem(files[0].filename or "converted")
        output_name = f"{base}.{extension}"
        job = Job(
            id=job_id, directory=directory, inputs=tuple(paths), input_format=source,
            output_format=output, output_name=output_name, output_path=directory / f"result.{extension}",
            operation=operation, settings=parsed,
            tool_id=tool.id if tool else None,
        )
        await asyncio.to_thread(manager.submit, job)
        return job.public()
    except InvalidFile as exc:
        await asyncio.to_thread(shutil.rmtree, directory, ignore_errors=True)
        raise ApiError(400, exc.code, str(exc)) from exc
    except ConversionError as exc:
        await asyncio.to_thread(shutil.rmtree, directory, ignore_errors=True)
        code = "QUEUE_FULL" if "queue is full" in str(exc).lower() else exc.code
        raise ApiError(503 if code == "QUEUE_FULL" else 400, code, str(exc)) from exc
    except Exception:
        await asyncio.to_thread(shutil.rmtree, directory, ignore_errors=True)
        raise
    finally:
        for upload in files:
            await upload.close()


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, object]:
    job = manager.get(job_id)
    if not job:
        raise ApiError(404, "JOB_NOT_FOUND", "Job not found or expired.")
    return job.public()


@app.get("/jobs/{job_id}/download")
def download_job(job_id: str, preview: bool = False) -> FileResponse:
    job = manager.get(job_id)
    if not job or job.status != JobStatus.COMPLETED or not job.output_path.is_file():
        raise ApiError(404, "JOB_NOT_FOUND", "Result not found or expired.")
    mime = mimetypes.guess_type(job.output_name)[0] or "application/octet-stream"
    allowed = {"application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "image/vnd.microsoft.icon", "image/x-icon", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "video/mp4", "video/webm", "text/plain"}
    inline = preview and mime in allowed
    return FileResponse(job.output_path, filename=job.output_name, media_type=mime if inline else "application/octet-stream", content_disposition_type="inline" if inline else "attachment", headers={"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox"} if inline else {})


@app.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str) -> None:
    try:
        if not manager.delete(job_id):
            raise ApiError(404, "JOB_NOT_FOUND", "Job not found.")
    except ConversionError as exc:
        raise ApiError(409, "CANNOT_CANCEL", str(exc)) from exc
