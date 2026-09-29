# Phase 7 review — production hardening

Baseline: `17e4098` on 2026-09-29. This phase tightened the existing ConvertBox service; it did not add conversion formats or new pages.

## Implemented

- Upload admission runs before multipart parsing: four active uploads, eight waiters, five-second acquisition timeout, in-process IP rate limit, free-disk and temporary-directory checks. Upload failures, including oversize and queue rejection, remove the allocated directory.
- Blocking file detection, Office container inspection, media probing and upload disk writes run off the FastAPI event loop. A concurrent `/health` request remains responsive during a slow detector.
- Server jobs have a bounded queue and output cap. PDF work is checked for page count and projected render pixels before expensive rendering; PDF ZIP creation has a size cap. Office conversion uses an isolated profile that is cleaned up.
- API errors carry codes such as `UPLOAD_BUSY`, `DISK_LOW`, `PDF_LIMIT` and `OUTPUT_TOO_LARGE`; the UI localizes codes in Chinese and English. `/health` is liveness; `/ready` checks storage and worker threads. Job lifecycle logs include format, operation, sizes, timestamps, duration, status and error code without file content.
- Animated WebP, APNG and GIF are rejected rather than flattened. The browser reads JPEG, PNG and WebP dimensions from headers where possible and schedules local jobs by estimated memory cost. Completed jobs with changed effective settings can be reconverted while the old output remains available.
- Browser ZIP input is capped at 64 MiB. Frontend and backend status transitions are checked. History and presets have schema versions and legacy loading. Workspace shell, file rows, settings, footer and queue scheduling are split into focused modules.
- CI runs a full Chromium suite and a critical Chromium/Firefox/WebKit suite with one worker, plus lightweight load checks. Direct deployment, resource limits, security, privacy and pipeline documentation were updated.

## Resource defaults

| Limit | Default |
| --- | ---: |
| `MAX_UPLOAD_SIZE` | 1 GiB |
| `MAX_CONCURRENT_UPLOADS` / `MAX_UPLOAD_WAITERS` | 4 / 8 |
| `MAX_CONCURRENT_JOBS` / `MAX_VIDEO_CONCURRENCY` | 2 / 1 |
| Queue capacity | 32 pending jobs |
| `MIN_FREE_DISK_BYTES` / `MAX_TEMP_USAGE` | 2 GiB / 10 GiB |
| `JOB_TTL` | 3600 seconds |
| `MAX_OUTPUT_SIZE` / `MAX_PDF_OUTPUT_BYTES` | 512 MiB / 512 MiB |
| `MAX_PDF_PAGES` / `MAX_PDF_RENDER_PIXELS` | 200 / 80 million estimated total |
| Local image input / decoded pixels | 25 MiB / 80 million |
| Local estimated memory budget | 256 MiB, two concurrent jobs at most |
| Browser ZIP input | 64 MiB |

See [resource limits](docs/RESOURCE_LIMITS.md) for enforcement details. The local memory figure is a scheduling estimate, not measured peak use.

## Verification

- Lint: PASS locally.
- Typecheck: PASS locally.
- Frontend unit: 19 PASS locally.
- API: 20 PASS locally, including real animation, alpha, EXIF, PDF, Office and media inputs.
- Quick load: PASS locally (20 concurrent ASGI uploads, queue saturation, low disk and scheduler regressions).
- Production build: PASS locally.
- Chromium full and Chromium/Firefox/WebKit critical E2E: 21 PASS in [GitHub CI for `499a05d`](https://github.com/Sver0411/ConvertBox/actions/runs/36564247771). The same run passed lint, typecheck, unit, API, production build and quick load checks.
- Docker build and startup: **NOT VERIFIED**. The user instructed us not to package or run Docker because the development machine has insufficient memory. The added Docker CI job was removed. Existing Compose files remain from earlier phases.
- Extended HTTP load and large conversion benchmarks: **NOT VERIFIED** on the available low-memory machine. No peak memory figures were collected; see [benchmarks](BENCHMARKS.md).

## Remaining limitations

- Browser ZIP still uses `Blob.arrayBuffer()` and `zipSync()` buffers, so the 64 MiB cap limits exposure but does not make ZIP generation streaming.
- Server processing jobs cannot be cancelled; queued jobs can. A cancel event is present in job state for future converter cooperation, but it is not exposed as a working processing cancel feature.
- The application has no kernel sandbox or per-job OS CPU/RAM quotas. Upload rate and queue state are process-local; a reverse proxy must enforce connection and body limits. Run one API process and one replica.
- Job state is lost on restart. The service has no distributed queue or shared object storage.
- Peak browser and server memory, 100 MiB media throughput and large PDF throughput are not benchmarked. Browser encoding and installed server converters determine available outputs.
