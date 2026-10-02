# Phase 8E — Utilities and persistence

Implemented local chunked SHA-256/SHA-1/MD5 with checksum verification, strict JSON formatting/minification/validation with line/column errors, flat JSON↔CSV, JSON↔YAML, ZIP create/extract/inspect with selected download, rename preview + ZIP. General file inspection uses server metadata parsers and treats unknown bytes as unknown instead of trusting a filename.

Tool presets v3 migrate existing custom v1/v2 presets while preserving original storage keys. History adds toolId/status and settings replay requires selecting source files again. Passwords and pasted text are not persisted. Generated docs/TOOLS.md includes 46 tool definitions and is checked in CI.

Validation: 33 frontend unit tests passed, including known hash vectors, CSV semantics/quotes/formula protection, JSON errors, YAML aliases, ZIP traversal/CRC and migration. Chromium suite 32 passed before the final crop resize handle improvement; final targeted smoke and API/build/CI verification are tracked in PHASE_8_REVIEW.md.

Known limits: archive input/expanded data 64 MiB, no ZIP64/encryption/legacy filename decoding; JSON/CSV supports flat arrays only; no full workflow engine or TAR/7z extraction.
