# Architecture

## Runtime boundaries

The Next.js page in `apps/web/src/components/workspace.tsx` handles file selection, settings, job orchestration, visible state and downloads. `packages/file-detection` checks client signatures, animation and image header dimensions; `packages/conversion-core` owns local image capability and validation. `apps/web/src/lib/local-scheduler.ts` reserves estimated memory for at most two local conversions. `image-converter.ts` uses a Web Worker with OffscreenCanvas and createImageBitmap where available, otherwise a Canvas fallback. The web app fetches `/capabilities` and merges tested browser outputs with server-advertised formats.

`apps/web/src/lib/workspace-views.ts` maps the left sidebar's All, Image, PDF, Word, Audio and Video workspaces to accepted inputs and visible outputs. These views reuse the same job list and converters; switching views does not start or cancel a job. History and About are panels in the same desktop layout. URL query `?tool=word` (and other view keys) opens a focused workspace directly.

Next.js rewrites same-origin `/api/*` to FastAPI. `admission.py` bounds uploads and checks disk space before multipart parsing. `main.py` streams uploads in 1 MB pieces into random per-job directories, detects their contents off the event loop, then enqueues a job. `jobs.py` owns a bounded in-process queue, two worker threads, a one-at-a-time video semaphore and TTL cleanup. `core.py` defines the Converter protocol and registry; `converters.py` holds image, PDF, Office and media implementations. `capabilities.py` advertises server outputs according to installed encoders and tools.

## Deployment model

The worker threads share the API process and local temporary directory. Run one API instance. Queue state does not survive process restarts. A multi-instance deployment requires shared job records, queue and object storage before horizontal scaling. This is the replacement boundary for Redis/RQ, rather than a claim that those systems already exist.

Direct process deployment is described in `docs/DEPLOYMENT.md`. The API exposes liveness, readiness and capabilities endpoints; no conversion SaaS is used. Existing Compose files were not built or run during Phase 7 because of limited memory.

## Limits

The browser handles local JPG/PNG/WebP up to 25 MB, 80 megapixels and a 256 MiB estimated scheduling budget. The server defaults to 1 GiB per request, four active uploads, eight waiting uploads, 32 queued jobs, two workers, one video slot and a one-hour file TTL. The browser batch limit is 100 items; in-memory ZIP input is capped at 64 MiB. Media conversion has a ten-minute watchdog; Office conversion has a two-minute subprocess timeout. See `docs/RESOURCE_LIMITS.md` for all defaults and enforcement points. External CPU/memory and reverse-proxy limits remain a deployment responsibility.
