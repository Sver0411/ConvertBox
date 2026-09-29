# Phase 2 review

## Implemented
- HEIC and AVIF server decoding/encoding when Pillow supports the codec; BMP/GIF still image conversion.
- Aspect-ratio-safe width/height adjustment in the browser worker and server converter.
- Metadata removal by re-encoding and optional server-side EXIF/ICC preservation.
- Five built-in presets plus up to 20 custom presets in localStorage.

## Not implemented
- SVG rasterization; animated GIF frame preservation; arbitrary metadata blocks beyond EXIF/ICC.

## Known bugs
- No known failing Phase 2 test. Some HEIC variants may be unsupported by the installed codec.

## Technical debt
- Custom preset editing is not exposed; users can delete and recreate a preset. Names are stored only in the current browser.

## Tests
- Real HEIC/AVIF/BMP/GIF conversion and JPEG EXIF tests in backend suite; resize, preset and theme in browser E2E. Integrated gate: lint, typecheck, 9 unit, 9 API, 9 E2E and production build passed on 2026-09-29.

## Performance
- 80-megapixel image cap; local jobs above 25 MB go to server when available. No benchmark or peak-memory measurement yet.

## Next phase
- PDF conversion and page operations.
