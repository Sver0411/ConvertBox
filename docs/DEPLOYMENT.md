# Direct deployment

ConvertBox is designed for a small self-hosted deployment with one FastAPI process and one Next.js process. This guide uses direct processes and does not require Docker.

## Requirements

Install Node.js 22+, npm 10+, Python 3.11+, `uv`, FFmpeg, LibreOffice and suitable fonts. Install project dependencies:

```bash
npm ci
cd apps/api && uv sync --extra test
```

Set environment values from `.env.example` for the API. Ensure `TEMP_DIRECTORY` is writable and has enough free space for inputs and results. The default `MIN_FREE_DISK_BYTES` is 2 GiB. For a private low-memory machine, adjust upload size, active uploads, worker count and temporary disk limits to match the machine before accepting traffic. Values must remain positive.

Run the API with a **single worker**:

```bash
cd apps/api
uv run uvicorn convertbox_api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Build and run the web process separately:

```bash
npm run build
API_INTERNAL_URL=http://127.0.0.1:8000 npm run start -w apps/web
```

Use a reverse proxy with TLS for public access. Limit request body size to at most `MAX_UPLOAD_SIZE`, apply IP based rate limiting and timeouts, and protect the service from untrusted traffic. `/health` checks whether the process responds; `/ready` also checks temporary storage and worker threads. Monitor free disk space, job failures and process restarts.

## Capacity and isolation

Use one API process and one API replica. `JobManager`, its queue and job state live in process memory; multiple workers or replicas would not share jobs. Source and result files live on local temporary storage. A restart loses active job state; stale directories are later cleaned.

Give the API an external CPU and memory limit appropriate to the host, plus a bounded temporary filesystem. This application itself does not apply per-job OS quotas or a kernel sandbox. FFmpeg, LibreOffice, Pillow and PDF tools process untrusted data, so keep them patched and isolate the service at the OS level when exposing it publicly. On a memory-constrained host, prefer `MAX_CONCURRENT_JOBS=1`, `MAX_CONCURRENT_UPLOADS=1`, and a lower upload cap; test with representative files before increasing them.

## Existing Compose files

The repository contains Compose files from earlier phases. Phase 7 did not build or run a Docker image because the development machine has insufficient memory. No Docker validation or Docker CI gate is claimed in this phase.
