import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectFileType } from "./detect";

describe("animation protection", () => {
  for (const [filename, type] of [["animated.webp", "image/webp"], ["animated.png", "image/png"]]) {
    it(`rejects real ${filename}`, async () => {
      const bytes = readFileSync(resolve(__dirname, "../../../tests/fixtures", filename));
      const file = new File([bytes], filename, { type });
      const result = await detectFileType(file);
      expect(result.category).toBe("unsupported");
      expect(result.errorCode).toBe("ANIMATED_IMAGE_UNSUPPORTED");
    });
  }
});
