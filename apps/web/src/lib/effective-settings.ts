import type { ConversionJob } from "@shared/index";

export interface EffectiveControls {
  quality: number; width: number; height: number; keepMetadata: boolean;
  pages: string; dpi: number; rotation: number; pdfOperation: string;
  bitrate: number; sampleRate: number; resolution: number; fps: number; videoQuality: string;
  pageSize: string; orientation: string; margin: string;
}

export function effectiveSettings(job: ConversionJob, controls: EffectiveControls, view: string): string {
  const output = job.settings.output;
  const type = job.descriptor.detectedType;
  const category = job.descriptor.category;
  const settings: Record<string, string | number | boolean> = { output };
  if (category === "image") {
    if (output !== "png") settings.quality = controls.quality;
    if (output !== "pdf") {
      settings.width = controls.width;
      settings.height = controls.height;
      settings.keepMetadata = controls.keepMetadata;
    } else {
      settings.pageSize = controls.pageSize;
      settings.orientation = controls.orientation;
      settings.margin = controls.margin;
    }
  } else if (category === "pdf") {
    const operation = view === "word" ? "convert" : controls.pdfOperation;
    settings.operation = operation;
    if (operation !== "compress" && operation !== "merge") settings.pages = controls.pages.trim() || "all";
    if (operation === "rotate") settings.rotation = controls.rotation;
    if (operation === "convert" && (output === "png" || output === "jpg")) settings.dpi = controls.dpi;
    if (operation === "convert" && output === "jpg") settings.quality = controls.quality;
  } else if (category === "audio" || category === "video") {
    settings.bitrate = controls.bitrate;
    if (category === "audio" || output === "mp3" || output === "wav") settings.sampleRate = controls.sampleRate;
    if (category === "video" && output !== "mp3" && output !== "wav") {
      settings.resolution = controls.resolution;
      settings.fps = controls.fps;
      settings.videoQuality = controls.videoQuality;
    }
  } else if (category === "office") {
    settings.input = type;
  }
  return JSON.stringify(settings);
}

export function isStale(job: ConversionJob, controls: EffectiveControls, view: string): boolean {
  return job.status === "COMPLETED" && !!job.lastCompletedSettings && job.lastCompletedSettings !== effectiveSettings(job, controls, view);
}
