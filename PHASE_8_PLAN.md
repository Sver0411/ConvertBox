# Phase 8 plan — File Workbench

Baseline: `5cc7bed` (`main`, 2026-09-29). The repository has Phase 7 upload admission, in-process jobs, local image scheduling, conversion matrix, format-specific workspace, presets and IndexedDB history. There is no general tool registry, tool-specific URL, non-file result, archive/data category, or tool handler registry.

## Current capabilities

- Browser: JPG/PNG/WebP conversion, resize and metadata removal; 64 MiB in-memory ZIP.
- Server: image/PDF/Office/audio/video conversions; PDF merge, split, rotate, optimize, image-to-PDF; bounded uploads, workers, output and PDF limits.
- UI: one conversion workspace with category views, presets/history, Chinese-first copy, English/theme switches.
- Detection: image/PDF/media/Office signatures with animation rejection. JSON/YAML/CSV/ZIP/TIFF/SVG are not yet supported.

## Tool model

`ToolDefinition` in the frontend registry has stable dotted ID, category, bilingual name/description, accepted inputs, processing location, batch/multi-input flags, result kind, operation, resource class, optional capability, settings schema and keywords. Tools Home, category pages, search and dynamic routes read this one registry. Only executable tools are published. `ToolExecutionRequest` and `ToolResult` separate file, multi-file, text and report results.

The existing `ConverterRegistry` continues to select format converters. A backend `ToolHandlerRegistry` selects non-conversion server operations by `toolId`. `POST /jobs` accepts an optional `toolId` while preserving the current `output`/`operation` contract for existing clients. `GET /capabilities` advertises handlers actually available on the host. Local-only tools do not upload files.

## Information architecture

`/` is a compact Tools Home with search, favorites, recent tools, popular tools and categories. `/tools/[category]/[tool]` is the stable route. Shared `ToolPage` handles ordinary upload/settings/run/result flows; crop and PDF organizer get specialized previews. A Cmd/Ctrl+K palette searches the same registry. The old conversion workspace remains accessible at `/convert` and through conversion tool routes.

Favorites and usage counts are versioned localStorage data. New tool presets are keyed by `toolId`; migration reads the existing v2 conversion presets. History gains optional `toolId` and status; it still stores metadata and settings, never source files.

## Delivery order

- **8A:** Registry, execution/result types, home, search, favorites/recent, stable dynamic URLs, shared page, migration and navigation tests.
- **8B:** Image compress/crop/rotate/flip/metadata/strip, TIFF, safe server SVG rasterization and favicon generation. Preserve animation and memory safeguards.
- **8C:** PDF organizer/extract/delete/watermark/page numbers/embedded images/metadata/password with page previews and content tests.
- **8D:** Audio trim/merge/normalize; video compress/trim/GIF/frames, bounded FFmpeg parameters and duration/output checks.
- **8E:** File inspector/hash, local JSON/CSV/YAML, safe ZIP create/extract/inspect, batch rename, updated docs and final review.

Target first batch: about 20 new, real operations across images, PDF, media, data, archives and file utilities. Where an operation cannot meet safety and test requirements, defer it visibly instead of adding a stub.

## Security and resources

Retain Phase 7 upload, disk, queue, output, PDF and local memory limits. SVG rasterization must reject script, foreignObject, external URLs/fonts and XML entities; do not put raw SVG in the DOM. Archive readers must bound compressed/uncompressed bytes and entry count, reject traversal/absolute paths/symlinks, and avoid extracting to user-controlled paths. JSON/YAML/CSV/XML parsing uses bounded text inputs; XML DTD/entity support is disabled. PDF passwords are never persisted or logged. FFmpeg edits retain timeout and output bounds. Every tool declares light/medium/heavy resource class and local/server location.

## Verification

Per subphase: lint, typecheck, unit, API, representative E2E and production build. Final CI must pass. Output tests inspect image dimensions/alpha, PDF page/text/order, media duration/codec, ZIP entry contents and known hash vectors. Review files `PHASE_8A_REVIEW.md` through `PHASE_8E_REVIEW.md` and `PHASE_8_REVIEW.md` record actual results and deferred work. `docs/TOOLS.md` is generated from the registry to avoid drift.

Docker build/run remains excluded per the user's earlier low-memory instruction. No AI chat, accounts, cloud storage, social features, ads, payment, workflow builder, or unrelated utility collection.
