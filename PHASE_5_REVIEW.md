# Phase 5 review

## Implemented
- MP4/MOV/MKV/WebM/AVI video input; MP4, WebM and MKV output according to FFmpeg encoder detection.
- Resolution, FPS and quality controls. Output uses H.264/AAC or VP9/Opus as appropriate.
- Streamed server-side upload in 1 MB chunks with a default 1 GB request cap.
- Background in-process queue (32 pending, two workers), one video slot, polling and actual FFmpeg progress.
- Ten-minute media watchdog, two-minute LibreOffice timeout, retry for failed jobs and cancellation of queued jobs.
- Per-job directories, one-hour result TTL, periodic and startup cleanup.

## Not implemented
- Processing-job cancellation, pause, resumable uploads, H.265/AV1 selection or a distributed queue.

## Known bugs
- No known failing Phase 5 test. Multi-instance deployment would lose queue ownership, so one API replica is required.

## Technical debt
- Next.js proxy behavior for near-1-GB uploads and external reverse-proxy limits need deployment-specific load tests.
- OS-level CPU and memory quotas belong to container/runtime configuration.

## Tests
- Real MP4→WebM/MKV and MP4→MP3 tests inspect FFprobe output; queue and API operations have integration coverage. Integrated gate: lint, typecheck, 9 unit, 9 API, 9 E2E and build passed.

## Performance
- Queue and video semaphore prevent unbounded simultaneous transcodes. No 4K/1-GB load benchmark was run.

## Next phase
- History, theme, mobile, documentation, deployment checks and wider QA.
