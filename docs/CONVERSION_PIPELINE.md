# Conversion pipeline

1. Browser `File` data is inspected by signature, extension and MIME. The server repeats independent checks after upload.
2. The UI chooses a local route only for supported JPG/PNG/WebP jobs at or below 25 MB. Every other route is marked Server before conversion.
3. Local jobs decode to pixels, enforce an 80-megapixel cap, calculate aspect-ratio-safe dimensions and encode with Canvas. Worker progress is stage-based because the browser encoder has no fractional callback. ImageBitmap is closed and object URLs are revoked.
4. Server files are streamed to a random job directory in 1 MB chunks, subject to the upload cap. The request returns a job ID as soon as upload and validation finish; conversion runs in a background worker.
5. The converter registry selects ImageConverter, PdfConverter, OfficeConverter or MediaConverter. FFmpeg progress reports `out_time_us / probed duration`, clamped below 100% until output verification. The browser polls the job endpoint. PDF and Office tasks show processing state without invented percentages.
6. Completed outputs are downloaded from the same-origin API proxy. Local results stay in page memory and may be zipped on demand if the total is under 200 MB. Server outputs are downloaded individually.
7. Completed/failed/cancelled server directories expire after the configured TTL. Startup also removes stale orphan directories.

The upload API already streams, but interrupted uploads cannot resume. A future resumable-upload adapter can stage verified chunks in each job directory before calling `JobManager.submit`. The conversion protocol need not change.
