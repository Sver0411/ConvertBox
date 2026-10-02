# Phase 8C — PDF tools

Implemented: thumbnail preview through bounded job queue, drag and button reordering, selection, rotation, deletion, extract/delete selected pages, text watermark, page numbers, extraction of original embedded images, metadata viewing/removal and AES-256 password protection. Password confirmation is checked in browser; only password sent to worker, cleared when worker finishes, excluded from presets/history.

Limits: 200 pages, 16 MiB preview/report cap, 1000 embedded images and existing server output cap; encrypted inputs cannot be edited without prior unlocking. Text watermarks support built-in Latin/CJK fonts. Full PDF visual accessibility and browser interaction verification remain pending.

Checkpoint: API tests verify page order/rotation/text, encrypted output authentication, embedded image dimensions and removed title; full API suite 39 passed. Web typecheck, unit and build passed. E2E/CI pending.
