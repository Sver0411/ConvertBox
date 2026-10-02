import { describe, expect, it } from "vitest";
import { getTool, searchTools, toolFromPath, toolPath, toolRegistry } from "./registry";

describe("tool registry", () => {
  it("has unique stable URLs and required execution metadata", () => {
    expect(new Set(toolRegistry.map(tool => tool.id)).size).toBe(toolRegistry.length);
    expect(new Set(toolRegistry.map(toolPath)).size).toBe(toolRegistry.length);
    for (const tool of toolRegistry) {
      expect(toolFromPath(tool.category, tool.id.slice(tool.category.length + 1))).toEqual(tool);
      expect(tool.acceptedInputs.length).toBeGreaterThan(0);
      expect(tool.operation).toBeTruthy();
      expect(tool.name.zh && tool.name.en).toBeTruthy();
    }
  });
  it("searches Chinese, English, format and operation keywords", () => {
    expect(searchTools("PDF").some(tool => tool.id === "pdf.merge")).toBe(true);
    expect(searchTools("jpg").some(tool => tool.id === "image.convert")).toBe(true);
    expect(searchTools("合并").map(tool => tool.id)).toContain("pdf.merge");
  });
  it("does not publish an unimplemented tool", () => {
    expect(getTool("unknown.stub")).toBeUndefined();
  });
});
