# Load checks

`npm run test:load` runs deterministic quick checks for 20 concurrent ASGI upload requests, queue saturation and cleanup, low disk, event-loop responsiveness, output/PDF limits, and the browser memory scheduler. It is safe for CI.

`npm run test:load:extended` sends 100 real HTTP requests to `CONVERTBOX_LOAD_URL` (default `http://127.0.0.1:8000`). Start an isolated server first. It reports wall time and status counts; it does not claim CPU or memory measurements.
