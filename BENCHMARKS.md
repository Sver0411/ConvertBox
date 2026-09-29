# Benchmarks

No reproducible conversion throughput benchmark was run in Phase 7. Large MP4 and PDF benchmarks were deliberately skipped on the available low-memory machine. Peak process and browser memory were not measured. Do not interpret the scheduler's estimated memory cost as measured peak use.

The deterministic quick load checks exercise admission with 20 concurrent ASGI requests, queue saturation, simulated low disk, output limits and local scheduling. They are regression checks rather than throughput benchmarks; see `tests/load/README.md` for the commands. The optional `npm run test:load:extended` sends 100 HTTP requests to an isolated running API and reports elapsed time and response counts without claiming memory measurements.
