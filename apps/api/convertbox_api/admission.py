"""Bounded upload admission before multipart body parsing and disk writes."""

from __future__ import annotations

import asyncio
import shutil
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from . import config
from .errors import ApiError, busy


def temp_usage(root: Path) -> int:
    if not root.exists():
        return 0
    total = 0
    for path in root.rglob("*"):
        if path.is_file() and not path.is_symlink():
            try:
                total += path.stat().st_size
            except FileNotFoundError:
                continue
    return total


def check_storage(root: Path) -> None:
    root.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(root).free < config.MIN_FREE_DISK_BYTES or temp_usage(root) >= config.MAX_TEMP_USAGE:
        raise ApiError(503, "DISK_LOW", "Server storage is temporarily unavailable.")


class UploadAdmission:
    def __init__(self, active_limit: int = config.MAX_CONCURRENT_UPLOADS,
                 waiting_limit: int = config.MAX_UPLOAD_WAITERS,
                 timeout: int = config.UPLOAD_ACQUIRE_TIMEOUT,
                 rate_limit: int = config.POST_JOBS_RATE_LIMIT) -> None:
        self.active_limit = active_limit
        self.waiting_limit = waiting_limit
        self.timeout = timeout
        self.rate_limit = rate_limit
        self.semaphore = asyncio.Semaphore(active_limit)
        self.lock = threading.Lock()
        self.active = 0
        self.waiting = 0
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check_rate(self, client: str) -> None:
        now = time.monotonic()
        with self.lock:
            hits = self.hits[client]
            while hits and now - hits[0] >= 60:
                hits.popleft()
            if len(hits) >= self.rate_limit:
                raise ApiError(429, "RATE_LIMITED", "Too many uploads. Please retry shortly.")
            hits.append(now)
            if len(self.hits) > 10_000:
                self.hits = defaultdict(deque, {key: value for key, value in self.hits.items() if value and now - value[-1] < 60})

    @asynccontextmanager
    async def slot(self):
        with self.lock:
            if self.active + self.waiting >= self.active_limit + self.waiting_limit:
                raise busy()
            self.waiting += 1
        acquired = False
        try:
            try:
                await asyncio.wait_for(self.semaphore.acquire(), timeout=self.timeout)
            except TimeoutError as exc:
                raise busy() from exc
            acquired = True
            with self.lock:
                self.waiting -= 1
                self.active += 1
            yield
        finally:
            with self.lock:
                if acquired:
                    self.active -= 1
                else:
                    self.waiting -= 1
            if acquired:
                self.semaphore.release()
