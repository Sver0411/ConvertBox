"""Manual HTTP burst against a running local API; never used in CI."""

import asyncio
import io
import os
import time
from collections import Counter

import httpx
from PIL import Image


async def main() -> None:
    url = os.environ.get("CONVERTBOX_LOAD_URL", "http://127.0.0.1:8000")
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(buffer, "PNG")
    data = buffer.getvalue()
    async with httpx.AsyncClient(timeout=20) as client:
        start = time.perf_counter()
        results = await asyncio.gather(*[
            client.post(f"{url}/jobs", files={"files": (f"load_{index}.png", data, "image/png")}, data={"output": "jpg"})
            for index in range(100)
        ])
        elapsed = time.perf_counter() - start
    counts = Counter(result.status_code for result in results)
    print({"requests": 100, "wall_seconds": round(elapsed, 3), "statuses": dict(counts)})
    if any(code not in (202, 429, 503) for code in counts):
        raise SystemExit("Unexpected response in load burst")


if __name__ == "__main__":
    asyncio.run(main())
