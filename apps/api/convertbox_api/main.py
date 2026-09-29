"""HTTP boundary: streamed upload, background jobs and result retrieval."""

from __future__ import annotations

import json
import os
import re
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .capabilities import PDF_OPERATIONS, can_convert, server_capabilities
from .converters import ConversionError
from .core import JobStatus
from .detection import InvalidFile, detect_file
from .jobs import Job, JobManager

MAX_UPLOAD_SIZE = int(os.environ.get("MAX_UPLOAD_SIZE", str(1024 * 1024 * 1024)))
manager = JobManager(workers=int(os.environ.get("MAX_CONCURRENT_JOBS", "2")))


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.start()
    yield
    manager.stop()


app = FastAPI(title="ConvertBox API", version="0.2.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/capabilities")
def capabilities() -> dict[str, object]:
    return {
        "version": 2,
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
) -> dict[str, object]:
    if not files or len(files) > 100:
        raise HTTPException(400, "Upload 1–100 files")
    try:
        parsed = json.loads(settings)
        if not isinstance(parsed, dict) or len(settings) > 4096:
            raise ValueError()
        allowed = {"quality", "width", "height", "pages", "dpi", "rotation", "bitrate", "sample_rate", "resolution", "fps", "video_quality", "page_size", "orientation", "margin", "keep_metadata"}
        parsed = {key: value for key, value in parsed.items() if key in allowed and isinstance(value, (str, int, float, bool))}
    except (ValueError, TypeError) as exc:
        raise HTTPException(400, "Invalid settings") from exc
    if operation not in ("convert", *PDF_OPERATIONS, "compress"):
        raise HTTPException(400, "Unsupported operation")
    job_id, directory = manager.allocate()
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
                        raise HTTPException(413, "Upload exceeds server limit")
                    target.write(chunk)
            kind = detect_file(raw, upload.filename or "")
            named = directory / f"input_{index}.{kind}"
            raw.rename(named)
            paths.append(named)
            detected.append(kind)
            await upload.close()
        source = detected[0]
        if operation != "convert":
            if source != "pdf" or any(kind != "pdf" for kind in detected):
                raise HTTPException(400, "PDF operation requires PDF inputs")
            if operation == "merge" and len(paths) < 2:
                raise HTTPException(400, "Merge requires at least two PDFs")
            if operation != "merge" and len(paths) != 1:
                raise HTTPException(400, "This PDF operation accepts one file")
            output = "pdf"
        elif len(paths) > 1:
            if output != "pdf" or any(kind not in ("jpg", "png", "webp", "bmp", "gif", "heic", "avif") for kind in detected):
                raise HTTPException(400, "Multiple files are supported for images to PDF")
        if not can_convert(source, output) and not (source == "pdf" and output == "pdf" and operation != "convert"):
            raise HTTPException(400, "Conversion is not supported")
        extension = "zip" if (source == "pdf" and output in ("png", "jpg")) or operation == "split" else output
        base = "merged" if operation == "merge" else "split" if operation == "split" else "images" if len(paths) > 1 and output == "pdf" else _safe_stem(files[0].filename or "converted")
        output_name = f"{base}.{extension}"
        job = Job(
            id=job_id, directory=directory, inputs=tuple(paths), input_format=source,
            output_format=output, output_name=output_name, output_path=directory / f"result.{extension}",
            operation=operation, settings=parsed,
        )
        manager.submit(job)
        return job.public()
    except (InvalidFile, ConversionError) as exc:
        shutil.rmtree(directory, ignore_errors=True)
        raise HTTPException(400, str(exc)) from exc
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, object]:
    job = manager.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found or expired")
    return job.public()


@app.get("/jobs/{job_id}/download")
def download_job(job_id: str) -> FileResponse:
    job = manager.get(job_id)
    if not job or job.status != JobStatus.COMPLETED or not job.output_path.is_file():
        raise HTTPException(404, "Result not found or expired")
    return FileResponse(job.output_path, filename=job.output_name, media_type="application/octet-stream")


@app.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str) -> None:
    try:
        if not manager.delete(job_id):
            raise HTTPException(404, "Job not found")
    except ConversionError as exc:
        raise HTTPException(409, str(exc)) from exc
