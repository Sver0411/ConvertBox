# Phase 7 plan — production hardening

Baseline: `17e40983d4690a3f6c7206ec95ee2279240a34ca` (`main`, 2026-09-29). Audit covered README, Phase 0–6 reviews, CI, Compose/Dockerfiles, API and web conversion code, and tests.

## Verified current state

| Item | Finding | Status |
| --- | --- | --- |
| Local image cap and scheduler | `MAX_PIXELS=80_000_000` and fixed `CONCURRENCY=2`; no pre-decode memory budget | Partially fixed |
| Browser ZIP | `Blob.arrayBuffer()` for every result, `zipSync(entries)`, then full ZIP Blob; 200 MB UI cap | Still affected |
| Reconvert | `runBatch` selects CREATED/FAILED/CANCELLED only; COMPLETED cannot be reprocessed | Still affected |
| Animated WebP/APNG | Signatures accepted, no animation detection; static canvas can discard frames | Still affected |
| Async validation | `create_job` calls synchronous `detect_file`, Office ZIP inspection, and ffprobe on event loop | Still affected |
| Upload admission | Queue capacity 32 begins after upload; no upload slot, waiting bound, disk admission, or app rate limit | Still affected |
| State machine | `canTransition`/`TRANSITIONS` exist but status is assigned directly | Still affected |
| Browser tests | Playwright config runs Chromium only | Still affected |
| Docker CI | CI does not call `docker compose build` | Still affected |

Already fixed and to retain: streamed 1 MB upload writes, bounded conversion queue, per-job directories and TTL, media and LibreOffice timeouts, real FFmpeg progress, and server capability detection. These do not substitute for upload admission or memory limits.

## Implementation order

### P0

1. Add bounded upload slots and bounded waiters, admission before writing, per-IP request rate limiting, disk free/temp-use checks, and complete cleanup on every rejected upload.
2. Move blocking detection and filesystem work off the event loop; prove a slow detector does not block `/health`.
3. Add structured API error codes and front-end localization; bound output and PDF work before expensive conversion.

### P1

4. Reject animated WebP, APNG and GIF before lossy single-frame paths, with real fixtures and localized errors.
5. Parse image headers before decode; add an estimated-memory local scheduler with a conservative budget and tests.
6. Preserve completed output, mark only effective setting changes stale, and permit explicit reconversion.
7. Bound browser ZIP memory (stream if practical, otherwise reduce cap to 64 MB and document buffers).
8. Enforce state transitions in server and browser job mutations.

### P2

9. Add Chromium full E2E and a critical Firefox/WebKit suite, capability-aware WebP checks, and main-thread fallback.
10. Add Docker build and healthcheck CI gate, readiness, and quick/extended load tests.
11. Split workspace UI and queue execution into focused modules without changing behavior.
12. Update deployment, resource, security, privacy, pipeline and architecture docs, measured benchmarks, and `PHASE_7_REVIEW.md`.

## Likely files

`apps/api/convertbox_api/{main,jobs,core,converters,detection}.py`, new API admission/errors/config modules and tests; `apps/web/src/{components/workspace.tsx,lib/image-converter.ts,lib/download.ts,lib/server-api.ts,lib/messages.ts,workers/image.worker.ts}`, new UI/queue modules; shared types and detection; `tests/e2e`, `tests/load`, Playwright config, Docker/Compose/CI, `.env.example`, README and docs.

## Planned configuration

`MAX_CONCURRENT_UPLOADS=4`, `MAX_UPLOAD_WAITERS=8`, `UPLOAD_ACQUIRE_TIMEOUT=5`, `MIN_FREE_DISK_BYTES=2147483648`, `MAX_TEMP_USAGE=10737418240`, `MAX_OUTPUT_SIZE=536870912`, `MAX_PDF_PAGES=200`, `MAX_PDF_RENDER_PIXELS=80000000`, `MAX_PDF_OUTPUT_BYTES=536870912`, and `POST_JOBS_RATE_LIMIT` parameters. Existing upload/job/video/TTL values remain configurable. A conservative browser local-memory budget and a smaller browser ZIP cap will be defined in web code and documented.

## Verification

Run lint, typecheck, unit, API, production build, Chromium full E2E, Firefox/WebKit critical E2E, quick load, Compose config/build, container health/ready/web checks when Docker is available, and GitHub CI. Extended load tests remain manually invoked. Test real output dimensions/streams/pages and generated edge-case fixtures without committing large binaries. Record measured benchmark values only; mark unavailable measurements `NOT VERIFIED`.

## Risks and exclusions

In-process queues imply one API replica. Admission inside FastAPI begins after ASGI multipart parsing; a reverse proxy must still enforce request body size and connection limits. Estimated browser memory is not actual peak RSS. Containers do not provide a kernel sandbox or hard resource isolation unless the deployment sets limits. No new format, OCR, login, cloud integration, AI, payment, new UI page, or large redesign is in scope.
