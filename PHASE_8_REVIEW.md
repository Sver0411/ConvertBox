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

## Verification — final code `7cc5628`

[Successful CI run](https://github.com/Sver0411/ConvertBox/actions/runs/36979825491), 2026-10-02:

| Gate | Result |
|---|---|
| Lint | PASS |
| Typecheck | PASS |
| Frontend unit | 35 PASS |
| API / processors | 49 PASS, no skips on Linux |
| E2E (Chromium full + Chromium/Firefox/WebKit critical) | 40 PASS |
| Production build | PASS; tool route ~208 kB first-load JS |
| Load regressions | 6 API + 2 memory scheduler PASS |
| Generated tool catalog consistency | PASS |

Local Mac API: 47 PASS / 2 skipped because Cairo and one required encoder are missing. The Linux gate supplies these dependencies and runs every processor test. The browser tests include actual free crop resizing/square pixel export and PDF export order, rotation and deletion, not only output existence. The documentation-only verification commit does not change executable code; it records this completed run.

Pushes use a temporary per-command Git DNS route; no global network configuration changed. Production preview started directly at localhost:3000 with the API at localhost:8000. Docker was not used.

## Limits / deferred

Cairo library unavailable on local Mac; SVG rasterization is capability gated and its runtime test skipped locally. One media processor test requires encoders absent here. CI Linux provides Cairo/FFmpeg and exercises available processors.

No OCR, encrypted PDF unlock, editable PDF metadata fields, multipage TIFF editing, arbitrary SVG/HTML rendering, complete workflow builder, complex waveform editor, GB ZIP support or TAR/GZ/7z extraction. Server batches provide separate download links; local multiple results support ZIP download. Existing converter preset UI remains compatible while ToolPage provides tool-bound presets. Server processing cannot be cancelled once running.

No mobile work was undertaken. Tool discovery uses scrolling inside the desktop panel for the expanded catalog; workflow panels scroll internally when settings/results are long.
