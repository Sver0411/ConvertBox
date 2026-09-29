import type { ConversionSettings, ImageFormat, JobStatus } from "@shared/index";

export const IMAGE_FORMATS: ImageFormat[] = ["jpg", "png", "webp"];
export const OUTPUT_MIME: Record<ImageFormat, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};
export const CAPABILITIES: Record<ImageFormat, ImageFormat[]> = {
  jpg: ["jpg", "png", "webp"],
  png: ["jpg", "png", "webp"],
  webp: ["jpg", "png", "webp"],
};

export function canConvert(input: ImageFormat, output: ImageFormat): boolean {
  return CAPABILITIES[input].includes(output);
}

export function validateSettings(settings: ConversionSettings): string | null {
  if (!IMAGE_FORMATS.includes(settings.output)) return "Unsupported output format.";
  if (!Number.isInteger(settings.quality) || settings.quality < 1 || settings.quality > 100) return "Quality must be between 1 and 100.";
  return null;
}

const transitions: Record<JobStatus, JobStatus[]> = {
  CREATED: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [], FAILED: ["VALIDATING"], CANCELLED: ["VALIDATING"],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return transitions[from].includes(to);
}
