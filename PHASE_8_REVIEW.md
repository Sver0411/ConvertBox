# Phase 8 — File Workbench review

Baseline: `5cc7bed`. Implemented in successive tool center, image/PDF, media and utility commits. No Docker built or started.

## Implemented

46 actual tools registered (11 previous conversion tools + 35 additions). [Generated tool catalog](docs/TOOLS.md) lists ID, names, accepted inputs, result kind, processing and resource class; all listed tools have execution handlers. Server tools are gated by current capability advertisement.

- Tool registry as frontend source of truth; searchable categorized home, favorites, recent, command palette, stable dynamic URLs.
- Shared ToolExecution/ToolPage and local/server result presentation; original Converter Registry remains responsible for conversion. ToolHandlerRegistry handles new operations through existing jobs.
- Image compress/crop/rotate/flip/metadata/strip/favicons; TIFF/ICO and guarded SVG conversion. Free crop has a resize handle; ratio presets support zoom and rotation.
- PDF organizer preview/order/rotate/delete/selection, selected-page extract/delete, watermark, page numbers, embedded-image extraction, metadata and AES-256 protect.
- Audio trim/ordered merge/normalize; video compress/trim/GIF/frames.
- File inspector, streaming checksums, JSON/CSV/YAML, safe ZIP, rename.
- Tool preset migration and tool-aware history replay. Source files are not retained in browser history; secrets excluded.

## Security

See [Workbench security](docs/WORKBENCH_SECURITY.md). SVG restricted allowlist + defusedxml + no resource fetch + subprocess timeout; ZIP central/local validation, traversal/symlink/encryption/ZIP64 rejection, expansion/entry caps and CRC; XML no DTD/entities. Password cleared from queued deletion and worker completion, never logged/persisted to presets/history. Original upload admission, disk headroom, queues, worker/video limits, output/PDF caps and TTL remain.

## Verification

- Lint PASS, typecheck PASS.
- Frontend unit 33 PASS.
- API: previous full local suite 46 PASS / 2 skipped; final changed processor/API subset 30 PASS / 2 skipped. Linux CI at `6c9968a` ran all 48 tests without skips. One additional palette test is included in the final gate.
- Chromium 32 PASS plus targeted visual crop and organizer export tests PASS. Tests inspect resize-handle movement, square pixel output, actual PDF page order/rotation and deletion.
- Production build PASS (tool route ~207 kB first-load JS).
- CI at `6c9968a`: PASS, 48 API / 32 unit / 38 cross-browser E2E / load regressions. Final hardening head gate pending. Pushes use a temporary per-command Git DNS route; no global network configuration changed.

## Limits / deferred

Cairo library unavailable on local Mac; SVG rasterization is capability gated and its runtime test skipped locally. One media processor test requires encoders absent here. CI Linux provides Cairo/FFmpeg and exercises available processors.

No OCR, encrypted PDF unlock, editable PDF metadata fields, multipage TIFF editing, arbitrary SVG/HTML rendering, complete workflow builder, complex waveform editor, GB ZIP support or TAR/GZ/7z extraction. Server batches provide separate download links; local multiple results support ZIP download. Existing converter preset UI remains compatible while ToolPage provides tool-bound presets. Server processing cannot be cancelled once running.

No mobile work was undertaken. Tool discovery uses scrolling inside the desktop panel for the expanded catalog; workflow panels scroll internally when settings/results are long.
