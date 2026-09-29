from fastapi.testclient import TestClient

from convertbox_api.core import JobStatus, can_transition
from convertbox_api.main import app


def test_health_and_empty_server_capabilities() -> None:
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/capabilities").json() == {"version": 1, "server": []}


def test_job_transitions() -> None:
    assert can_transition(JobStatus.QUEUED, JobStatus.PROCESSING)
    assert not can_transition(JobStatus.COMPLETED, JobStatus.PROCESSING)
