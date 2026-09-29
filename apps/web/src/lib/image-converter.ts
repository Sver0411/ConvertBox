import { OUTPUT_MIME, validateSettings } from "@core/capabilities";
import type { ConversionSettings, ConversionStage } from "@shared/index";

const MAX_PIXELS = 80_000_000;

export async function convertImage(
  file: File,
  settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const invalid = validateSettings(settings);
  if (invalid) throw new Error(invalid);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    return convertInWorker(file, settings, onStage, signal);
  }
  return convertOnMainThread(file, settings, onStage, signal);
}

function convertInWorker(
  file: File, settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void, signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/image.worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (error?: Error, blob?: Blob) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else if (blob) resolve(blob);
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ stage?: ConversionStage; blob?: Blob; error?: string }>) => {
      if (event.data.stage) onStage(event.data.stage);
      if (event.data.error) finish(new Error(event.data.error));
      if (event.data.blob) finish(undefined, event.data.blob);
    };
    worker.onerror = () => finish(new Error("Browser image worker failed. Please retry."));
    worker.postMessage({ file, mime: OUTPUT_MIME[settings.output], quality: settings.quality / 100, maxPixels: MAX_PIXELS });
    if (signal.aborted) abort();
  });
}

async function convertOnMainThread(
  file: File, settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void, signal: AbortSignal,
): Promise<Blob> {
  onStage("decoding");
  const sourceUrl = URL.createObjectURL(file);
  let bitmap: ImageBitmap | null = null;
  try {
    let width: number;
    let height: number;
    let image: HTMLImageElement | null = null;
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      image = new Image();
      image.src = sourceUrl;
      await image.decode();
      width = image.naturalWidth;
      height = image.naturalHeight;
    }
    if (!width || !height || width * height > MAX_PIXELS) throw new Error("Image is too large to decode safely (80 megapixel limit).");
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    onStage("encoding");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    if (settings.output === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap ?? image!, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Image encoding failed.")),
      OUTPUT_MIME[settings.output], settings.quality / 100,
    ));
    canvas.width = 0;
    canvas.height = 0;
    if (blob.type !== OUTPUT_MIME[settings.output]) throw new Error(`${settings.output.toUpperCase()} encoding is unavailable in this browser.`);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return blob;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(error instanceof Error ? error.message : "This image could not be decoded or encoded.");
  } finally {
    bitmap?.close();
    URL.revokeObjectURL(sourceUrl);
  }
}

export function browserCanEncode(format: ConversionSettings["output"]): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.toDataURL(OUTPUT_MIME[format]).startsWith(`data:${OUTPUT_MIME[format]}`);
}
