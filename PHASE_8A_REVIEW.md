# Phase 8A — tool navigation

Implemented a single typed tool registry, local favorites and recent usage, Chinese/English search, Ctrl/Cmd+K palette and dynamic `/tools/[category]/[tool]` routes. The home page is a tool center; the existing conversion workspace remains at `/convert`. Server-dependent tools are filtered by runtime capabilities. Only executable existing tools were registered in this subphase.

Validation: lint and typecheck PASS; 22 frontend unit tests PASS; 20 API tests PASS; production build PASS. Existing browser tests were moved to `/convert`; a new browser smoke test checks search, favorite persistence, recent tools and stable URLs. Browser verification will run in GitHub CI to avoid additional local browser memory use. Generic tool execution, non-file results and preset/history migration are delivered alongside the new tool processors in the following subphases.
