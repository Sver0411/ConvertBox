import { expect, it } from "vitest";
import { effectiveSettings, isStale, type EffectiveControls } from "./effective-settings";
import type { ConversionJob } from "@shared/index";

const controls: EffectiveControls = { quality: 85, width: 0, height: 0, keepMetadata: false, pages: "all", dpi: 144, rotation: 90, pdfOperation: "convert", bitrate: 192, sampleRate: 0, resolution: 0, fps: 0, videoQuality: "high", pageSize: "auto", orientation: "auto", margin: "none" };

it("marks only effective setting changes stale", () => {
  const job = { status: "COMPLETED", settings: { output: "png", quality: 85 }, descriptor: { category: "image", detectedType: "png" } } as ConversionJob;
  job.lastCompletedSettings = effectiveSettings(job, controls, "image");
  expect(isStale(job, { ...controls, quality: 30 }, "image")).toBe(false);
  expect(isStale(job, { ...controls, width: 500 }, "image")).toBe(true);
  job.settings.output = "jpg";
  expect(isStale(job, controls, "image")).toBe(true);
});
