import { describe, expect, it } from "vitest";
import { canConvert, canTransition, validateSettings } from "./capabilities";
import { outputFilename, uniqueFilename } from "./filename";

describe("conversion core", () => {
  it("provides real phase 1 capabilities", () => {
    expect(canConvert("png", "webp")).toBe(true);
    expect(canConvert("webp", "jpg")).toBe(true);
  });
  it("validates quality", () => {
    expect(validateSettings({ output: "jpg", quality: 85 })).toBeNull();
    expect(validateSettings({ output: "jpg", quality: 0 })).toMatch(/Quality/);
  });
  it("enforces job transitions", () => {
    expect(canTransition("QUEUED", "PROCESSING")).toBe(true);
    expect(canTransition("COMPLETED", "PROCESSING")).toBe(false);
  });
  it("sanitizes names and resolves collisions", () => {
    expect(outputFilename("../报告:image.png", "webp")).toBe("报告_image.webp");
    const used = new Set<string>();
    expect(uniqueFilename("图像.webp", used)).toBe("图像.webp");
    expect(uniqueFilename("图像.webp", used)).toBe("图像_1.webp");
  });
});
