# Phase 3 review

## Implemented
- PDF to PNG/JPG by page, with ranges and DPI; selectable text to TXT or text-only DOCX.
- Images to PDF with page size, orientation, margins and order controls.
- PDF merge, per-page or grouped-range split, rotate and object-stream optimization.
- Office DOC/DOCX/ODT, XLS/XLSX/ODS and PPT/PPTX/ODP to PDF via LibreOffice.

## Not implemented
- OCR or faithful PDF-to-Word layout restoration. PDF optimization does not guarantee a smaller file.
- Drag gesture ordering; accessible up/down controls provide the same ordering result.

## Known bugs
- No known failing Phase 3 test.

## Technical debt
- PDF render outputs always use a ZIP, including a single page. Large PDF rendering can require substantial server RAM.

## Tests
- API verifies PDF pages, merge, split, rotation, optimization and Office output with PyMuPDF. Browser E2E verifies PDF/Word and ordered image-to-PDF downloads. Integrated gate: lint, typecheck, 9 unit, 9 API, 9 E2E and build passed.

## Performance
- PDF image rendering checks projected page pixels against the 80-megapixel cap.

## Next phase
- FFmpeg audio conversion and extraction.
