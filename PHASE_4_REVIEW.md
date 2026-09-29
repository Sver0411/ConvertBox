# Phase 4 review

## Implemented
- FFmpeg audio conversion among MP3, WAV, FLAC, M4A, OGG and OPUS where runtime encoders are present.
- MP4/MOV/MKV/WebM/AVI audio extraction to MP3 or WAV.
- Bitrate and sample-rate controls; actual FFmpeg progress parsed from output time.

## Not implemented
- Waveform editing, trimming and normalization, which are outside the first release.

## Known bugs
- No known failing Phase 4 test. Source videos without an audio stream cannot produce an audio output.

## Technical debt
- AAC is accepted as input; standalone AAC output is omitted because compatibility and metadata handling need more validation.

## Tests
- Real WAV→FLAC/OGG and video→MP3 tests check readable FFprobe output; browser E2E downloads MP3 from audio and video. Integrated gate: lint, typecheck, 9 unit, 9 API, 9 E2E and build passed.

## Performance
- Audio conversion runs in server worker threads and shares the bounded job queue.

## Next phase
- Video conversion, queue limits, timeout and upload handling.
