import { describe, expect, it } from "vitest";
import type { FileDescriptor } from "@shared/index";
import { preferredOutput, viewAccepts, viewOutputs } from "./workspace-views";

function file(detectedType: string, category: FileDescriptor["category"]): FileDescriptor {
  return { name: `sample.${detectedType}`, extension: detectedType, mime: "", detectedType, size: 100,
    category, signature: detectedType, supportedConversions: [] };
}

describe("focused conversion workspaces", () => {
  it("routes Word and PDF inputs to the correct output", () => {
    expect(viewAccepts("word", file("docx", "office"))).toBe(true);
    expect(viewAccepts("word", file("png", "image"))).toBe(false);
    expect(preferredOutput("word", file("pdf", "pdf"), viewOutputs("word", file("pdf", "pdf"), ["png", "docx"]), "png")).toBe("docx");
    expect(viewOutputs("pdf", file("png", "image"), ["jpg", "png", "pdf"])).toEqual(["pdf"]);
  });
  it("keeps image, audio extraction and video output choices focused", () => {
    expect(viewOutputs("image", file("jpg", "image"), ["webp", "pdf"])).toEqual(["webp"]);
    expect(viewOutputs("audio", file("mp4", "video"), ["mp4", "mp3", "wav"])).toEqual(["mp3", "wav"]);
    expect(viewOutputs("video", file("mp4", "video"), ["mp4", "webm", "mp3"])).toEqual(["mp4", "webm"]);
  });
});
