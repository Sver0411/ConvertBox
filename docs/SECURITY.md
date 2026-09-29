# Security

## Implemented

- Server jobs use random IDs and private independent directories. User input cannot specify an output path; filenames are reduced to safe display/download names.
- The browser validates signature, extension and MIME; the server validates file bytes again and probes media streams. Office ZIPs have entry-count and expanded-size caps.
- Uploads are copied in 1 MiB chunks with a default 1 GiB request cap. Admission allows four active and eight waiting uploads, with a five-second wait and a 20-per-minute-per-IP limiter. Storage admission requires 2 GiB free disk and rejects when ConvertBox temporary use reaches 10 GiB. The queue holds at most 32 pending jobs; two workers run concurrently, with one video slot.
- Browser images have a 25 MiB input cap, 80-megapixel decoded/output cap and estimated 256 MiB scheduler budget. Server images use Pillow's 80-megapixel guard. Animated WebP, APNG and GIF are rejected rather than flattened.
- Outputs over 512 MiB are removed. PDF inputs are limited to 200 pages, with pre-render pixel checks and an output ZIP cap.
- FFmpeg and LibreOffice run via subprocess argument arrays without a shell. Media conversion has a ten-minute watchdog; LibreOffice has a two-minute timeout.
- The public job response strips internal FFmpeg details. Results expire after one hour by default; startup and periodic cleanup remove stale directories.
- React renders filenames as text. ZIP and download names are sanitized.

## Deployment requirements and residual risk

Run the API as an unprivileged process with external disk, memory and CPU limits and a restricted filesystem/network policy. Put request rate limits and request-body limits on the public reverse proxy as an additional boundary; the in-process IP limiter is not distributed and should not be treated as abuse protection across replicas. The in-process queue is suitable for one API process and does not persist across restart. Malicious media/Office files still reach FFmpeg/LibreOffice/Pillow, so operators should keep packages patched and isolate the API at the OS level. The current implementation does not impose per-job OS-level memory or CPU quotas or provide malware scanning. See `docs/DEPLOYMENT.md`.
