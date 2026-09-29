# Security

## Implemented

- Server jobs use random IDs and private independent directories. User input cannot specify an output path; filenames are reduced to safe display/download names.
- The browser validates signature, extension and MIME; the server validates file bytes again and probes media streams. Office ZIPs have entry-count and expanded-size caps.
- Uploads are copied in 1 MB chunks with a default 1 GB request cap. The queue holds at most 32 pending jobs; two workers run concurrently, with one video slot.
- Browser images have a 25 MB input cap and 80-megapixel decoded/output cap. Server images use Pillow's 80-megapixel guard.
- FFmpeg and LibreOffice run via subprocess argument arrays without a shell. Media conversion has a ten-minute watchdog; LibreOffice has a two-minute timeout.
- The public job response strips internal FFmpeg details. Results expire after one hour by default; startup and periodic cleanup remove stale directories.
- React renders filenames as text. ZIP and download names are sanitized.

## Deployment requirements and residual risk

Run the API container as an unprivileged user with disk, memory and CPU limits and a restricted filesystem/network policy. Put request rate limits and request-body limits on the public reverse proxy. The in-process queue is suitable for one API replica and does not persist across restart. Malicious media/Office files still reach FFmpeg/LibreOffice/Pillow, so operators should keep packages patched and isolate the API container. The current implementation does not impose per-job OS-level memory or CPU quotas or provide malware scanning.
