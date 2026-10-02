# Workbench boundaries

## Processing

Data transformation, hash, ZIP and rename run in the browser. The UI uses task-oriented labels; help and upload status explain server processing. Hybrid image tools use browser processing for static JPEG/PNG/WebP and the server for other inputs or ICC preservation. Server batches run sequentially; downloads remain direct links so large outputs are not loaded as browser Blobs.

Image selections are capped at 100; image batch inputs and retained outputs each at 64 MiB. ZIP create/rename may select up to 1000 entries within the ZIP byte cap. Hash remains chunked and accepts large individual files.

## SVG

2 MiB, 5000 elements, 12000 px dimension / 80 MP limits. defusedxml rejects DTD/entities/external entities. An allowlist excludes script, foreignObject, image, style and use; event handlers, external href/URLs and custom font declarations are rejected. Cairo resource fetching is denied. Rendering runs in a child process with a 30 second deadline. SVG source is never inserted into the DOM. Cairo must be installed by the deployment operator; capabilities omit SVG when missing. Accepted SVG is deliberately a restricted subset.

## Archives

ZIP only, up to 64 MiB compressed and declared expanded data, 1000 entries. Preflight rejects absolute paths, drive letters, backslashes, traversal, control characters, symlinks, encryption, duplicate paths, unsupported compression, ZIP64 and multipart archives. Local and central headers are checked before extraction. Streaming inflation checks expanded lengths; CRC is verified before download. Creation and extraction are bounded in-memory operations, not suitable for GB archives. UTF-8 entry names only. Selected downloads flatten folders and resolve filename collisions.

## Data / XML

8 MiB UTF-8 text. Strict JSON parsing reports line/column. CSV requires unique headers and consistent column counts; nested JSON is rejected. Spreadsheet formula prefixes are escaped. YAML aliases are forbidden and non-finite values are rejected before JSON conversion. XML inspection uses defusedxml with DTD/entities disabled. No HTML-to-PDF feature is provided.

## PDF / media

Editable PDF up to 200 pages, previews/reports up to 16 MiB, extracted images up to 1000 and existing 512 MiB output cap. Password-protected inputs cannot be edited. New password protection uses AES-256; confirmation stays in the browser. Password is excluded from logs, history, presets and replay and is cleared from job settings after processing or queued deletion. Worker memory may hold it while a job runs; no persisted password store is created.

Media source duration at most one hour, audio merge 2–20 files with one hour total. GIF up to 15 seconds/800 px/20 FPS. Frames up to 100, each scaled to at most 1920 px wide. FFmpeg has fixed argument construction, two decoder threads, filter thread limits, 600 second timeout and output cap. Processing jobs cannot be cancelled; original queue/admission/disk/TTL limits remain in force.

## Storage / migration

Tool favorites/recent/presets remain local. Version 3 tool presets import existing v1/v2 custom presets without removing old keys. History gains toolId/status while retaining existing rows and files remain absent. Replay uses settings and requires selecting source files again. Password and pasted content are excluded. JSON report and metadata may contain sensitive content; they remain within the self-hosted server and browser until the existing TTL expires.

## Scope

No OCR, encrypted PDF unlocking, multipage TIFF editing, HTML rendering, TAR/GZ/7z extraction or workflow editor. GZIP/7z/RAR signatures are inspection-only. No account, third-party file processing API or cloud storage.


## Preview and workflow controls

- Preview downloads use an allowlist of passive image, PDF, audio, video and text MIME types, `nosniff`, and a sandbox CSP. SVG and unknown files remain attachment downloads.
- PDF page rendering is bounded; normal preview renders one page at 640×800 maximum, organizer thumbnails at 160×200. At most 12 organizer thumbnails are shown at once.
- Audio waveform computation streams mono PCM through FFmpeg and retains at most 4,096 peak values; browser preview never decodes an entire long recording into an AudioBuffer.
- Route drafts are memory-only: at most three tools and 64 MiB of retained input/output blobs and text. Passwords are excluded. Persistent presets/history exclude passwords, input text, expected hashes and derived file duration/page counts.
- Batch results preserve successful items and retry failed inputs. Repacking ZIP entries keeps validated paths; all packing and extracted content remain under existing byte/entry/CRC guards.
- Processing cancellation signals the worker; external FFmpeg/Office/Tesseract processes are killed and reaped. Native image/PDF code completes its current step before cancellation is observed.
- HTTP 429 keeps the production admission limit and returns Retry-After. The client can wait and retry twice, with cancellation. The E2E server alone uses a higher request limit for rapid synthetic test jobs.
- Optional OCR uses installed Tesseract and fixed-version official language models. Rasterization is bounded to 20 pages, 144 DPI and 20 million pixels per page; temporary page images are deleted as each page finishes.
