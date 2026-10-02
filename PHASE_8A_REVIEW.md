# Phase 8A — tool navigation

Implemented a single typed tool registry, local favorites and recent usage, Chinese/English search, Ctrl/Cmd+K palette and dynamic `/tools/[category]/[tool]` routes. The home page is a tool center; the existing conversion workspace remains at `/convert`. Server-dependent tools are filtered by runtime capabilities. Only executable existing tools were registered in this subphase.

Validation: lint and typecheck PASS; 22 frontend unit tests PASS; 20 API tests PASS; production build PASS. Existing browser tests were moved to `/convert`; a new browser smoke test checks search, favorite persistence, recent tools and stable URLs. Browser verification will run in GitHub CI to avoid additional local browser memory use. Generic tool execution, non-file results and preset/history migration are delivered alongside the new tool processors in the following subphases.

## Final integrated verification — 2026-10-02

Final code `7cc5628`: lint/typecheck/build/catalog PASS, 35 frontend unit, 49 API and 40 cross-browser E2E PASS; load regressions PASS. [CI run](https://github.com/Sver0411/ConvertBox/actions/runs/36979825491). Earlier pending checks above describe their subphase checkpoints; final integrated checks are complete. See PHASE_8_REVIEW.md for limits and deferred work.
