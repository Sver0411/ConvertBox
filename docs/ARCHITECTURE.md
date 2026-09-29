# Architecture

## Running code

`apps/web/src/components/workspace.tsx` owns the browser job list, drag/drop, two-worker scheduling, settings and result actions. It delegates detection to `packages/file-detection/src/detect.ts`, capability checks to `packages/conversion-core`, and conversion to `apps/web/src/lib/image-converter.ts`. The converter chooses `apps/web/src/workers/image.worker.ts` when Worker, OffscreenCanvas and createImageBitmap are available; otherwise it uses the main-thread Canvas fallback. Outputs are Blobs. `apps/web/src/lib/download.ts` handles individual files and bounded ZIP generation.

`apps/api` is a separate FastAPI package. In Phase 1 it exposes `/health` and `/capabilities`, whose server list is empty. It has a Python `Converter` protocol, registry and job transition model for later server converters. There is no upload route or server queue yet because the only implemented conversions are local. The browser does not call this API.

## Boundary

The TypeScript capability matrix is the single source for active image options. The eventual API server capability response will list registered, healthy server converters; the UI will merge it with local capabilities only when server conversion is implemented. Client MIME and file extensions are never enough to establish a server capability.

## Deployment

Docker Compose starts the Next.js web container and the FastAPI boundary container. The browser Worker is bundled into the web app and runs in each visitor's browser. No separate server worker container is claimed for Phase 1.

## Future server path

HTTP upload adapter → Job Manager → Conversion Queue → Worker → Converter Registry → Converter. The upload adapter will stream into a random job directory. The queue interface will support a later Redis/RQ adapter without changing the converter protocol. A job event endpoint can report actual FFmpeg `out_time` against probed duration. Server jobs need TTL cleanup and persistent state before any upload UI appears.
