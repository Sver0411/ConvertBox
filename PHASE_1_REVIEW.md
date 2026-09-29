# Phase 1 review

## Implemented

- Next.js browser workbench with Chinese default language and a manually written English switch. All visible controls, states, notices and errors are localized. The page uses minimal text and restrained glass styling. Decorative eyebrow text and the prominent logo were removed after visual review; animation is limited to drag feedback, workspace/file entry, active conversion and real progress changes, with reduced-motion support.
- JPG/JPEG, PNG and WebP signature detection plus MIME/extension consistency checks. Corrupt or unsupported files do not stop other files in a batch.
- Real local conversion via Web Worker and OffscreenCanvas where supported, with Canvas fallback. JPEG transparency is flattened to white; re-encoding removes source metadata.
- Shared output format and quality settings, two-at-a-time batch queue, honest file-stage and settled-count progress, cancel, retry, remove, individual download and ZIP download.
- Output names are sanitized, including path separators and common reserved punctuation. Duplicate ZIP names receive numeric suffixes.
- FastAPI health and empty server capability endpoints, converter protocol and server job state foundation. No server conversion is enabled or advertised.
- CI, Docker Compose files, real screenshots, architecture/security/privacy documents and automated tests.

## Not implemented

HEIC, AVIF, resize, explicit metadata control, PDF, audio, video, history, saved presets, server upload/queue and streaming are later phases. The FastAPI app is a boundary only in Phase 1. There is no server worker process yet. Pause is omitted because browser image encoders cannot pause safely.

## Known bugs and limits

- Browser image decoders and encoders vary. WebP output is probed; a file using an unsupported codec may still fail at decode time with an actionable error.
- Input cap: 25 MB each; decoded cap: 80 megapixels; batch cap: 100 files; ZIP output cap: 200 MB. The ZIP builder materializes output bytes in memory, so larger archives are intentionally unavailable.
- The main-thread fallback may briefly block interaction during a large decode/encode on browsers without the required Worker APIs.
- Individual image encoders expose no fractional progress, so the UI shows actual stages and completed-file count rather than a made-up per-file percentage.
- Docker Compose configuration validates, but container images were not built locally because the Docker daemon was unavailable during review.

## Tests

| Gate | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 8 passed |
| Playwright Chromium | 4 passed: PNG→WebP and downloaded signature; invalid file isolation; JPG/WebP batch→PNG and ZIP contents; language switch |
| FastAPI pytest | 2 passed |
| Next.js production build | Passed |
| `docker compose config --quiet` | Passed |
| `docker compose build` | Not run to completion: local Docker daemon unavailable |

## Performance

Image conversion concurrency is 2, with a 25 MB per-file and 80-megapixel decoded guard. Browser output Blobs remain in memory while results are visible. ZIP creation adds a temporary allocation; it is capped. No representative throughput benchmark has been recorded yet. The UI does not claim peak-memory measurements.

## Technical debt

The browser job scheduler currently lives in the workspace component. Before adding server jobs or resumable uploads, move scheduling behind a dedicated queue adapter and add persisted job metadata. Add cross-browser Safari coverage and larger real-image fixtures before claiming broad browser reliability. Server capability registration and health checks must exist before any Server option is shown.

## Next phase

Add HEIC/AVIF only through verified decoders and browser fallback behavior, then resize and user-visible metadata controls. Extend fixture coverage and cross-browser tests first.
