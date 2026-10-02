"""Bounded in-process queue and temporary result lifecycle."""

from __future__ import annotations

import logging
import os
import queue
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from .capabilities import VIDEO_INPUTS
from .converters import ConversionError, make_registry
from .core import ConversionRequest, JobStatus, can_transition
from . import config
from .tool_handlers.registry import make_tool_registry

log = logging.getLogger(__name__)
TEMP_ROOT = Path(os.environ.get("TEMP_DIRECTORY", str(Path(tempfile.gettempdir()) / "convertbox")))
JOB_TTL = int(os.environ.get("JOB_TTL", "3600"))


@dataclass
class Job:
    id: str
    directory: Path
    inputs: tuple[Path, ...]
    input_format: str
    output_format: str
    output_name: str
    output_path: Path
    operation: str
    settings: dict[str, str | int | float | bool]
    tool_id: str | None = None
    status: JobStatus = JobStatus.CREATED
    progress: float | None = None
    error: str | None = None
    error_code: str | None = None
    created_at: float = field(default_factory=time.time)
    queued_at: float | None = None
    started_at: float | None = None
    completed_at: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    def transition(self, target: JobStatus) -> None:
        if self.status == target:
            return
        if not can_transition(self.status, target):
            log.error("Illegal job transition job_id=%s from=%s to=%s", self.id, self.status, target)
            raise ValueError(f"Illegal job transition {self.status} → {target}")
        self.status = target

    def public(self) -> dict[str, object]:
        return {
            "id": self.id, "toolId": self.tool_id, "status": self.status.value, "progress": self.progress,
            "error": self.error, "errorCode": self.error_code, "outputName": self.output_name if self.status == JobStatus.COMPLETED else None,
            "outputSize": self.output_path.stat().st_size if self.status == JobStatus.COMPLETED and self.output_path.exists() else None,
            "createdAt": self.created_at,
        }


class JobManager:
    @staticmethod
    def _log_event(job: Job, event: str) -> None:
        def size(path: Path) -> int:
            try:
                return path.stat().st_size
            except OSError:
                return 0

        input_bytes = sum(size(path) for path in job.inputs)
        output_bytes = size(job.output_path)
        duration = round(job.completed_at - job.started_at, 3) if job.completed_at and job.started_at else None
        log.info("job_event=%s job_id=%s input_format=%s output_format=%s operation=%s input_bytes=%s output_bytes=%s queued_at=%s started_at=%s completed_at=%s duration=%s status=%s error_code=%s",
                 event, job.id, job.input_format, job.output_format, job.operation, input_bytes, output_bytes,
                 job.queued_at, job.started_at, job.completed_at, duration, job.status.value, job.error_code)

    def __init__(self, root: Path = TEMP_ROOT, workers: int = 2, ttl: int = JOB_TTL) -> None:
        self.root = root
        self.ttl = ttl
        self.jobs: dict[str, Job] = {}
        self.lock = threading.RLock()
        self.queue: queue.Queue[str | None] = queue.Queue(maxsize=32)
        self.threads: list[threading.Thread] = []
        self.stop_event = threading.Event()
        self.media_slots = threading.Semaphore(max(1, int(os.environ.get("MAX_VIDEO_CONCURRENCY", "1"))))
        self.worker_count = max(1, min(4, workers))
        self.registry = make_registry()
        self.tool_registry = make_tool_registry()

    def start(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self.cleanup_orphans()
        if self.threads:
            return
        self.stop_event.clear()
        for index in range(self.worker_count):
            thread = threading.Thread(target=self._work, name=f"convertbox-worker-{index}", daemon=True)
            thread.start()
            self.threads.append(thread)
        cleaner = threading.Thread(target=self._cleanup_loop, name="convertbox-cleanup", daemon=True)
        cleaner.start()
        self.threads.append(cleaner)

    def stop(self) -> None:
        self.stop_event.set()
        for _ in range(self.worker_count):
            try:
                self.queue.put_nowait(None)
            except queue.Full:
                pass
        for thread in self.threads:
            thread.join(timeout=3)
        self.threads.clear()

    def allocate(self) -> tuple[str, Path]:
        self.root.mkdir(parents=True, exist_ok=True)
        job_id = uuid.uuid4().hex
        directory = self.root / f"job_{job_id}"
        directory.mkdir(mode=0o700)
        return job_id, directory

    def submit(self, job: Job) -> None:
        with self.lock:
            if job.status == JobStatus.CREATED:
                job.transition(JobStatus.VALIDATING)
            job.transition(JobStatus.QUEUED)
            job.queued_at = time.time()
            self.jobs[job.id] = job
        try:
            self.queue.put_nowait(job.id)
        except queue.Full:
            with self.lock:
                self.jobs.pop(job.id, None)
            shutil.rmtree(job.directory, ignore_errors=True)
            raise ConversionError("Server queue is full; retry shortly")
        self._log_event(job, "queued")

    def get(self, job_id: str) -> Job | None:
        with self.lock:
            return self.jobs.get(job_id)

    def delete(self, job_id: str) -> bool:
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
            if job.status == JobStatus.PROCESSING:
                job.cancel_event.set()
                return True
            job.settings.pop("password", None)
            job.cancel_event.set()
            job.transition(JobStatus.EXPIRED if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED) else JobStatus.CANCELLED)
            self.jobs.pop(job_id, None)
        shutil.rmtree(job.directory, ignore_errors=True)
        return True

    def cleanup_expired(self) -> int:
        now = time.time()
        expired: list[Job] = []
        with self.lock:
            for job in tuple(self.jobs.values()):
                if job.status not in (JobStatus.PROCESSING, JobStatus.QUEUED) and now - (job.completed_at or job.created_at) >= self.ttl:
                    job.transition(JobStatus.EXPIRED)
                    expired.append(job)
                    del self.jobs[job.id]
        for job in expired:
            shutil.rmtree(job.directory, ignore_errors=True)
        return len(expired)

    def cleanup_orphans(self) -> int:
        removed = 0
        now = time.time()
        for directory in self.root.glob("job_*"):
            if directory.is_symlink() or not directory.is_dir():
                continue
            if directory.name[4:] in self.jobs:
                continue
            if now - directory.stat().st_mtime >= self.ttl:
                shutil.rmtree(directory, ignore_errors=True)
                removed += 1
        return removed

    def _cleanup_loop(self) -> None:
        while not self.stop_event.wait(60):
            self.cleanup_expired()

    def _work(self) -> None:
        while not self.stop_event.is_set():
            try:
                job_id = self.queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if job_id is None:
                self.queue.task_done()
                return
            job = self.get(job_id)
            if not job or job.status != JobStatus.QUEUED:
                self.queue.task_done()
                continue
            with self.lock:
                job.transition(JobStatus.PROCESSING)
                job.started_at = time.time()
            self._log_event(job, "started")
            try:
                converter = self.tool_registry.get(job.tool_id) if job.tool_id else self.registry.find(job.input_format, job.output_format)
                if converter is None:
                    raise ConversionError("Converter is not available")
                request = ConversionRequest(
                    input_path=job.inputs[0], output_path=job.output_path,
                    input_format=job.input_format, output_format=job.output_format,
                    settings=job.settings, input_paths=job.inputs, operation=job.operation,
                    on_progress=lambda fraction: self._set_progress(job, fraction),
                    cancelled=job.cancel_event.is_set,
                )
                converter.validate(request)
                if job.input_format in VIDEO_INPUTS:
                    with self.media_slots:
                        converter.convert(request)
                else:
                    converter.convert(request)
                if job.cancel_event.is_set():raise ConversionError("Processing cancelled", "CANCELLED")
                if not job.output_path.is_file() or job.output_path.stat().st_size == 0:
                    raise ConversionError("Converter produced no output")
                if job.output_path.stat().st_size > config.MAX_OUTPUT_SIZE:
                    raise ConversionError("Output exceeds server size limit", "OUTPUT_TOO_LARGE")
                with self.lock:
                    job.transition(JobStatus.COMPLETED)
                    job.progress = 1.0
                    job.completed_at = time.time()
                self._log_event(job, "completed")
            except ConversionError as exc:
                log.warning("Job %s rejected: %s", job.id, exc)
                job.output_path.unlink(missing_ok=True)
                with self.lock:
                    job.transition(JobStatus.CANCELLED if job.cancel_event.is_set() else JobStatus.FAILED)
                    job.error = str(exc).split(":", 1)[0]
                    job.error_code = exc.code
                    job.completed_at = time.time()
                self._log_event(job, "failed")
            except Exception:
                log.exception("Job %s failed", job.id)
                job.output_path.unlink(missing_ok=True)
                with self.lock:
                    job.transition(JobStatus.CANCELLED if job.cancel_event.is_set() else JobStatus.FAILED)
                    job.error = "Server conversion failed"
                    job.error_code = "CONVERSION_FAILED"
                    job.completed_at = time.time()
                self._log_event(job, "failed")
            finally:
                job.settings.pop("password", None)
                self.queue.task_done()

    def _set_progress(self, job: Job, fraction: float) -> None:
        if job.cancel_event.is_set():raise ConversionError("Processing cancelled","CANCELLED")
        with self.lock:
            job.progress = fraction
