# Phase 8D — Media tools

Added audio trim, ordered merge (2–20 files), loudnorm presets; video compression, trim, bounded GIF and frame extraction. Outputs are processed by ToolHandlerRegistry through the existing admitted uploads and worker queue. Video jobs retain the video semaphore. FFmpeg commands have fixed arguments, two decoder threads, one filter thread, timeout and output cap.

Limits: known source duration up to one hour; merge total at most one hour; GIF 15 seconds, 800 px wide, 20 FPS; frames at most 100 and width at most 1920. No precise size prediction. No waveform editor. Available encoder gates control visibility; one media test skipped locally because a required encoder is unavailable.

Processor tests verify audio/video durations, output resolution, GIF frame count and extracted frame count. Checkpoint API: 45 passed, 1 skipped; web unit: 31 passed; lint/typecheck passed. E2E underway; CI cannot yet be checked because GitHub connection fails.

## Final integrated verification — 2026-10-02

Final code `7cc5628`: lint/typecheck/build/catalog PASS, 35 frontend unit, 49 API and 40 cross-browser E2E PASS; load regressions PASS. [CI run](https://github.com/Sver0411/ConvertBox/actions/runs/36979825491). Earlier pending checks above describe their subphase checkpoints; final integrated checks are complete. See PHASE_8_REVIEW.md for limits and deferred work.
