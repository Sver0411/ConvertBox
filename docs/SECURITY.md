# Security

## Implemented in Phase 1

- No upload endpoint receives user files.
- Magic bytes, MIME and extension are checked together. Conflicting known values fail.
- Browser decoder validates the complete image before encoding.
- Each input is capped at 25 MB and decoded images at 80 megapixels. Batches are capped at 100 files; ZIP output bytes are capped at 200 MB.
- Files are shown as React text, not HTML. Download names strip separators, control characters and common reserved punctuation; collision suffixes avoid duplicate ZIP entries.
- Conversion work is bounded to two concurrent image jobs. Active browser Workers are terminated on cancellation.

## Required before server conversion is enabled

Repeat signature checks on the server, stream uploads with a hard byte cap, allocate random per-job directories, disallow user output paths, enforce CPU/time/disk limits, invoke FFmpeg through argument arrays without a shell, map internal errors to safe user messages, expire result files and run periodic cleanup. Container deployment alone does not establish all these guarantees.
