"""Admission, cleanup, and event-loop regressions use real HTTP parsing."""

import asyncio
import io
import threading
import time
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
from PIL import Image
import pymupdf

from convertbox_api import admission as admission_module
from convertbox_api import main
from convertbox_api.admission import UploadAdmission
from convertbox_api.jobs import Job, JobManager
from convertbox_api import config
from convertbox_api.detection import InvalidFile, detect_file
from convertbox_api.core import JobStatus


def image_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (2, 2), "red").save(buffer, "PNG")
    return buffer.getvalue()


def post_png(client: TestClient):
    return client.post("/jobs", files=[("files", ("sample.png", image_bytes()))], data={"output": "jpg"})


def test_oversize_upload_removes_directory(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    monkeypatch.setattr(main, "MAX_UPLOAD_SIZE", 10)
    with TestClient(main.app) as client:
        result = post_png(client)
    assert result.status_code == 413
    assert result.json()["detail"]["code"] == "FILE_TOO_LARGE"
    assert not list(tmp_path.glob("job_*"))


def test_readiness_checks_workers_and_storage(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    with TestClient(main.app) as client:
        assert client.get("/ready").json() == {"status": "ready"}
        monkeypatch.setattr(config, "MIN_FREE_DISK_BYTES", 10**30)
        response = client.get("/ready")
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "NOT_READY"


def test_low_disk_refuses_before_allocation(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    real_disk_usage = admission_module.shutil.disk_usage
    monkeypatch.setattr(admission_module.shutil, "disk_usage", lambda path: type("Usage", (), {"free": 0})())
    try:
        with TestClient(main.app) as client:
            result = post_png(client)
    finally:
        monkeypatch.setattr(admission_module.shutil, "disk_usage", real_disk_usage)
    assert result.status_code == 503
    assert result.json()["detail"]["code"] == "DISK_LOW"
    assert not list(tmp_path.glob("job_*"))


def test_slow_detection_does_not_block_health(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    started = threading.Event()

    def slow_detect(path, name):
        started.set()
        time.sleep(0.6)
        return "png"

    monkeypatch.setattr(main, "detect_file", slow_detect)
    monkeypatch.setattr(main.manager, "submit", lambda job: None)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
            upload = asyncio.create_task(client.post("/jobs", files={"files": ("sample.png", image_bytes())}, data={"output": "jpg"}))
            assert await asyncio.to_thread(started.wait, 2)
            health = await asyncio.wait_for(client.get("/health"), timeout=0.3)
            assert health.status_code == 200
            assert (await upload).status_code == 202

    asyncio.run(exercise())


def test_twenty_uploads_are_bounded(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    guarded = UploadAdmission(active_limit=2, waiting_limit=2, timeout=1, rate_limit=1000)
    monkeypatch.setattr(main, "admission", guarded)
    monkeypatch.setattr(main.manager, "submit", lambda job: None)
    lock = threading.Lock()
    active = 0
    peak = 0

    def slow_detect(path, name):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.25)
        with lock:
            active -= 1
        return "png"

    monkeypatch.setattr(main, "detect_file", slow_detect)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
            requests = [client.post("/jobs", files={"files": ("sample.png", image_bytes())}, data={"output": "jpg"}) for _ in range(20)]
            return await asyncio.gather(*requests)

    results = asyncio.run(exercise())
    assert peak <= 2
    assert any(item.status_code == 202 for item in results)
    assert any(item.status_code == 429 and item.json()["detail"]["code"] == "UPLOAD_BUSY" for item in results)
    assert all(item.status_code in (202, 429) for item in results)


def test_queue_saturation_removes_rejected_job(tmp_path: Path) -> None:
    manager = JobManager(root=tmp_path, workers=1)
    manager.queue.maxsize = 1

    def job() -> Job:
        id, directory = manager.allocate()
        return Job(id=id, directory=directory, inputs=(), input_format="png", output_format="jpg", output_name="x.jpg", output_path=directory / "x.jpg", operation="convert", settings={})

    first, second = job(), job()
    manager.submit(first)
    try:
        manager.submit(second)
    except ValueError:
        pass
    else:
        raise AssertionError("Full queue accepted another job")
    assert first.directory.exists()
    assert not second.directory.exists()


def test_output_limit_fails_and_removes_result(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    monkeypatch.setattr(config, "MAX_OUTPUT_SIZE", 10)
    with TestClient(main.app) as client:
        response = post_png(client)
        assert response.status_code == 202
        job_id = response.json()["id"]
        for _ in range(100):
            state = client.get(f"/jobs/{job_id}").json()
            if state["status"] == "FAILED":
                break
            time.sleep(0.05)
        assert state["status"] == "FAILED"
        assert state["errorCode"] == "OUTPUT_TOO_LARGE"
        assert not (tmp_path / f"job_{job_id}" / "result.jpg").exists()


def test_pdf_page_limit_rejects_before_render(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(main.manager, "root", tmp_path)
    monkeypatch.setattr(config, "MAX_PDF_PAGES", 1)
    source = pymupdf.open()
    source.new_page()
    source.new_page()
    data = source.tobytes()
    source.close()
    with TestClient(main.app) as client:
        response = client.post("/jobs", files={"files": ("two.pdf", data)}, data={"output": "png"})
        assert response.status_code == 202
        job_id = response.json()["id"]
        for _ in range(100):
            state = client.get(f"/jobs/{job_id}").json()
            if state["status"] == "FAILED":
                break
            time.sleep(0.05)
        assert state["status"] == "FAILED"
        assert state["errorCode"] == "PDF_LIMIT"
        assert not (tmp_path / f"job_{job_id}" / "result.zip").exists()


def test_animated_images_are_rejected_before_conversion() -> None:
    root = Path(__file__).resolve().parents[3] / "tests" / "fixtures"
    for filename in ("animated.webp", "animated.png", "animated.gif"):
        try:
            detect_file(root / filename, filename)
        except InvalidFile as exc:
            assert exc.code == "ANIMATED_IMAGE_UNSUPPORTED"
        else:
            raise AssertionError(f"{filename} lost its animation guard")


def test_server_status_transitions_are_enforced(tmp_path: Path) -> None:
    job = Job(id="test", directory=tmp_path, inputs=(), input_format="png", output_format="jpg", output_name="x.jpg", output_path=tmp_path / "x.jpg", operation="convert", settings={})
    job.transition(JobStatus.VALIDATING)
    job.transition(JobStatus.QUEUED)
    try:
        job.transition(JobStatus.COMPLETED)
    except ValueError:
        pass
    else:
        raise AssertionError("Illegal transition was accepted")
