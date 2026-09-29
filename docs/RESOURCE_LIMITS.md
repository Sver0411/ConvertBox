# Resource limits

Defaults below apply to one API process unless the environment overrides them. See `.env.example` and `apps/api/convertbox_api/config.py`.

| Resource | Default | Enforcement |
| --- | ---: | --- |
| Request upload | 1 GiB | Streamed in 1 MiB chunks; oversize upload rejected and its directory removed |
| Active uploads | 4 | Admission slot acquired before multipart parsing |
| Waiting uploads | 8 | Further requests receive `UPLOAD_BUSY` |
| Upload wait | 5 s | Timed out requests receive `UPLOAD_BUSY` |
| Uploads per IP | 20 / 60 s | In-process limiter on `POST /jobs`; reverse proxy limits remain useful |
| Free temporary disk | 2 GiB minimum | New uploads rejected with `DISK_LOW` |
| ConvertBox temporary usage | 10 GiB maximum | New uploads rejected with `DISK_LOW` |
| Pending server queue | 32 jobs | Further jobs rejected and upload directory removed |
| Server workers | 2 by default | Thread workers in one API process |
| Video slots | 1 | Semaphore around conversion |
| Single output | 512 MiB | Checked immediately after conversion; oversized output removed |
| PDF source pages | 200 | Checked before processing |
| PDF render pixels | 80 million total estimated | Checked before rendering selected pages |
| PDF output ZIP | 512 MiB | Checked while building the archive |
| Completed server job TTL | 1 hour | Periodic cleanup; process restart removes stale orphans |
| Local image input | 25 MiB | Browser admission |
| Local image pixels | 80 million | Header check and decode guard |
| Local estimated memory | 256 MiB | Scheduler reserves `max(input pixels, output pixels) × 12`; up to two local conversions run together |
| Browser ZIP | 64 MiB input total | In-memory ZIP; server results download individually |

The local estimate is a scheduling heuristic, not measured peak memory. Browser memory pressure can still be higher. Image header dimensions are read for JPEG, PNG and WebP before decoding where possible. Animated WebP, APNG and GIF conversion is rejected to avoid silently dropping frames.

The upload limiter and job queue are process-local. Disk usage is checked before and during upload, but multiple writers or other processes can consume space between checks. FFmpeg and LibreOffice use watchdogs and argument arrays. The application does not impose operating-system CPU or RAM quotas on each conversion. Use a dedicated host or external process isolation for untrusted public workloads.
