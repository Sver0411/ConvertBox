import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: [
    { command: "cd ../api && uv run --extra test python -m uvicorn convertbox_api.main:app --host 127.0.0.1 --port 8000", url: "http://127.0.0.1:8000/health", reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
