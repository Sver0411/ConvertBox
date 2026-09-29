# Architecture

## Runtime boundaries

The Next.js page in `apps/web/src/components/workspace.tsx` handles file selection, format-specific settings, two-at-a-time browser orchestration, visible job state and downloads. `packages/file-detection` checks client signatures; `packages/conversion-core` owns local image capability and validation. `apps/web/src/lib/image-converter.ts` runs a Web Worker with OffscreenCanvas and createImageBitmap where available, otherwise a Canvas fallback. The web app fetches `/capabilities` and merges tested browser outputs with server-advertised formats.

Next.js rewrites same-origin `/api/*` to FastAPI. `apps/api/convertbox_api/main.py` streams uploads in 1 MB pieces into random per-job directories, detects their contents again, then enqueues a job. `jobs.py` owns a bounded in-process queue, two worker threads, a one-at-a-time video semaphore and TTL cleanup. `core.py` defines the Converter protocol and registry; `converters.py` holds image, PDF, Office and media implementations. `capabilities.py` advertises server outputs according to installed encoders and tools.

## Deployment model

The worker threads share the API process and local temporary directory. Run one API instance. Queue state does not survive process restarts. A multi-instance deployment requires shared job records, queue and object storage before horizontal scaling. This is the replacement boundary for Redis/RQ, rather than a claim that those systems already exist.

Docker Compose starts web and API containers. API bundles FFmpeg and LibreOffice. `API_INTERNAL_URL` controls the web-to-API rewrite at build time. The API exposes health and capabilities endpoints; no conversion SaaS is used.

## Limits

The browser handles local JPG/PNG/WebP up to 25 MB and 80 megapixels. The server defaults to 1 GB per upload request, 32 queued jobs, two workers, one video slot and a one-hour file TTL. Values that are configurable are in `.env.example`. The browser batch limit is 100 items. Media conversion has a ten-minute watchdog; Office conversion has a two-minute subprocess timeout. External container CPU/memory and reverse-proxy limits remain a deployment responsibility.
