"""Resource limits shared by admission and conversion workers."""

import os


def positive_int(name: str, default: int) -> int:
    value = int(os.environ.get(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be positive")
    return value


MAX_UPLOAD_SIZE = positive_int("MAX_UPLOAD_SIZE", 1024 * 1024 * 1024)
MAX_CONCURRENT_UPLOADS = positive_int("MAX_CONCURRENT_UPLOADS", 4)
MAX_UPLOAD_WAITERS = positive_int("MAX_UPLOAD_WAITERS", 8)
UPLOAD_ACQUIRE_TIMEOUT = positive_int("UPLOAD_ACQUIRE_TIMEOUT", 5)
MIN_FREE_DISK_BYTES = positive_int("MIN_FREE_DISK_BYTES", 2 * 1024**3)
MAX_TEMP_USAGE = positive_int("MAX_TEMP_USAGE", 10 * 1024**3)
MAX_OUTPUT_SIZE = positive_int("MAX_OUTPUT_SIZE", 512 * 1024**2)
MAX_PDF_PAGES = positive_int("MAX_PDF_PAGES", 200)
MAX_PDF_RENDER_PIXELS = positive_int("MAX_PDF_RENDER_PIXELS", 80_000_000)
MAX_PDF_OUTPUT_BYTES = positive_int("MAX_PDF_OUTPUT_BYTES", 512 * 1024**2)
POST_JOBS_RATE_LIMIT = positive_int("POST_JOBS_RATE_LIMIT", 20)
