import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000" },
  projects: [
    { name: "chromium-full", use: { ...devices["Desktop Chrome"] }, testMatch: ["convert.spec.ts", "workbench.spec.ts"] },
    { name: "chromium-critical", use: { ...devices["Desktop Chrome"] }, testMatch: "critical.spec.ts" },
    { name: "firefox-critical", use: { ...devices["Desktop Firefox"] }, testMatch: "critical.spec.ts" },
    { name: "webkit-critical", use: { ...devices["Desktop Safari"] }, testMatch: "critical.spec.ts" },
  ],
  webServer: [
    { command: "cd ../api && uv run --extra test python -m uvicorn convertbox_api.main:app --host 127.0.0.1 --port 8000", url: "http://127.0.0.1:8000/health", reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
