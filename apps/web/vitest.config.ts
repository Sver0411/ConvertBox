import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: {
    "@core": resolve(__dirname, "../../packages/conversion-core/src"),
    "@detection": resolve(__dirname, "../../packages/file-detection/src"),
    "@shared": resolve(__dirname, "../../packages/shared-types/src"),
  } },
  test: { environment: "node", include: ["src/**/*.test.ts", "../../packages/**/*.test.ts"] },
});
