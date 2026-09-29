# ConvertBox — Phase 0 design

## 1. Product goal

ConvertBox is a no-account, no-ad browser workbench for ordinary file conversion. The first release deliberately exposes only verified image conversions. Every job visibly says where processing happens. Unsupported formats remain visible as unsupported, never offered as a working conversion.

## 2. MVP scope

Phase 1 accepts JPEG, PNG and WebP, detects them from bytes, and converts each to the other two formats. It provides drag/drop and file selection, a batch-wide output format and quality control, a bounded concurrent queue, honest completed-file progress, per-file errors, individual downloads and a ZIP download. All Phase 1 conversion runs locally; no uploaded file reaches a server. Metadata is removed by canvas re-encoding, so the interface says so. Resize, HEIC, AVIF, PDF, audio, video, history and saved presets are later phases.

## 3. Technology stack

Next.js App Router, React, TypeScript and plain CSS for the web app; native File/Blob/ArrayBuffer APIs; a dedicated Web Worker using createImageBitmap and OffscreenCanvas when available; main-thread Canvas fallback for browsers without those worker APIs; `fflate` for ZIP. Vitest covers pure logic, Playwright covers the browser flow. A separate Python/FastAPI package defines the future server job boundary without intercepting local images. No external conversion API is used.

## 4. Directory structure

`apps/web` holds routes, components, local image workers and styles. `packages/conversion-core` owns the capability matrix and conversion settings. `packages/file-detection` owns signatures and descriptors. `packages/shared-types` owns common domain types. `apps/api` holds future server entry points, converter protocol and job state. `docs` explains implemented behavior and future boundaries. `tests/e2e` holds browser tests.

## 5. Conversion pipeline

Browser File → bounded signature read → descriptor/extension consistency check → capability lookup → validate output/quality → queue → worker decode → canvas encode → Blob result → object URL download → release object URL on removal/unmount. The batch progress numerator is completed/failed/cancelled file count, never an invented byte percentage. Individual jobs report real stages (queued, decoding, encoding, completed) because browser image encoders provide no fractional progress API. Worker fallback is selected by feature detection.

## 6. Converter interface

The core contract is `supports(input, output)`, `validate(descriptor, settings)`, `estimate(descriptor, settings)` and `convert(file, settings, onStage, signal): Promise<Blob>`. The Phase 1 image implementation is browser-side. Server-side converters later implement the equivalent Python `Converter` protocol and register by capabilities; API handlers will not branch on individual extensions.

## 7. Job state machine

States: CREATED → VALIDATING → QUEUED → PROCESSING → COMPLETED; validation/processing can move to FAILED; queued/processing can move to CANCELLED; FAILED/CANCELLED can Retry through VALIDATING; completed server jobs eventually become EXPIRED. Local jobs are ephemeral and output Blobs are released on removal or page close. Pause is omitted because browser encoders cannot pause safely.

## 8. Format capability matrix

One TypeScript source in `packages/conversion-core/src/capabilities.ts` drives the Phase 1 UI and validation:

| Input | Output | Location | Caveat |
| --- | --- | --- | --- |
| JPEG | JPEG, PNG, WebP | Local | Same-format output re-encodes; WebP requires encoder support |
| PNG | JPEG, PNG, WebP | Local | Same-format output re-encodes; JPEG replaces transparency with white |
| WebP | JPEG, PNG, WebP | Local | Same-format output re-encodes; browser must decode WebP |

The browser probes actual encoding support. Formats outside this matrix are unsupported in Phase 1. Future server capabilities will be supplied by a versioned API endpoint and merged with local capabilities; there will not be independently handwritten front/back lists.

## 9. Local / server boundary

Phase 1 image bytes stay in the browser. The web app does not post files to FastAPI. Later PDF, audio and video paths will show **Server** before upload unless a tested local implementation exists. Server capabilities are disabled until registered and health-checked. Privacy wording must describe the selected route, not a blanket site claim.

## 10. File lifecycle

Local input File objects are held only by the active page. Output Blobs stay in memory while results are shown. Object URLs are revoked when a job is removed or the workspace unmounts. ZIP data is created on demand and its object URL is revoked after download. Future server uploads use one random job directory, streamed writes, short-lived results, TTL expiry and periodic cleanup. Resumable chunk uploads can replace the upload adapter without changing the job API.

## 11. Security model

Detection checks signatures, MIME and extension, rejecting contradictory known signatures. Filename display remains text; download names strip path separators and control characters. Conversion limits input size and decoded pixel area to prevent excessive browser memory use. The future server must re-detect bytes, stream uploads, enforce size/time/resource limits, generate paths itself, execute FFmpeg with argv (no shell), and remove expired job directories. SVG and arbitrary HTML are excluded from Phase 1.

## 12. Testing strategy

Unit tests cover signature recognition, mismatch rejection, capability matrix, filenames, settings and state transitions. Browser E2E uses a real PNG fixture, converts to WebP, sets quality, checks the resulting MIME/signature and download. Lint, typecheck, unit tests, E2E and production build are required phase gates. API tests become required once file processing APIs exist.

## 13. Phase 1 implementation plan

1. Scaffold web project and pure packages with strict TypeScript.
2. Build signature-based descriptors and capability lookup.
3. Implement worker image conversion, fallback, bounded queue and cancellation.
4. Build responsive workspace with honest per-file states and batch progress.
5. Add ZIP downloads, automated tests, CI and deployment instructions.
6. Run gates and document the implemented surface, limitations and measured test results in `PHASE_1_REVIEW.md`.

## UI wireframe

Initial: slim text-only navigation, one headline, one large drop zone, privacy note. Workspace: header and add-files control, supported/unsupported count, shared format/quality settings, ordered file list with status and actions, aggregate progress, result downloads. Mobile stacks settings and list vertically. No inactive navigation or pretend controls. Chinese is the default language; a manual English switch covers all user-facing controls, states and errors. Copy is short and functional, without decorative eyebrow text. Visual direction: Apple-like typography, spacing and restrained color; a subtle liquid-glass treatment on the navigation and primary workspace surface only. Controls retain opaque-enough backgrounds and high contrast for readability; no decorative glass layer blocks interaction. Motion is used only for drag/drop and job feedback, and respects reduced-motion preferences.
