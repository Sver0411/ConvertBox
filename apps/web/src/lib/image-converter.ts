import { OUTPUT_MIME, validateSettings } from "@core/capabilities";
import { outputDimensions } from "@core/dimensions";
import type { ConversionSettings, ConversionStage } from "@shared/index";

const MAX_PIXELS = 80_000_000;

export interface ImageMetrics { decodeMs: number; encodeMs: number; totalMs: number; inputBytes: number; outputBytes: number; pixels: number }

export async function convertImage(
  file: File,
  settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void,
  signal: AbortSignal,
  onMetrics?: (metrics: ImageMetrics) => void,
): Promise<Blob> {
  const invalid = validateSettings(settings);
  if (invalid) throw new Error(invalid);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    return convertInWorker(file, settings, onStage, signal, onMetrics);
  }
  return convertOnMainThread(file, settings, onStage, signal, onMetrics);
}

function convertInWorker(
  file: File, settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void, signal: AbortSignal, onMetrics?: (metrics: ImageMetrics) => void,
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
    worker.onmessage = (event: MessageEvent<{ stage?: ConversionStage; blob?: Blob; error?: string; metrics?: ImageMetrics }>) => {
      if (event.data.stage) onStage(event.data.stage);
      if (event.data.error) finish(new Error(event.data.error));
      if (event.data.metrics) onMetrics?.(event.data.metrics);
      if (event.data.blob) finish(undefined, event.data.blob);
    };
    worker.onerror = () => finish(new Error("Browser image worker failed. Please retry."));
    worker.postMessage({ file, mime: OUTPUT_MIME[settings.output], quality: settings.quality / 100, maxPixels: MAX_PIXELS, width: settings.width ?? 0, height: settings.height ?? 0, background:settings.background });
    if (signal.aborted) abort();
  });
}

async function convertOnMainThread(
  file: File, settings: ConversionSettings,
  onStage: (stage: ConversionStage) => void, signal: AbortSignal, onMetrics?: (metrics: ImageMetrics) => void,
): Promise<Blob> {
  const started = performance.now();
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
    const decoded = performance.now();
    const [outputWidth, outputHeight] = outputDimensions(width, height, settings.width, settings.height);
    if (outputWidth * outputHeight > MAX_PIXELS) throw new Error("Output image is too large (80 megapixel limit).");
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    onStage("encoding");
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    if (settings.output === "jpg") {
      context.fillStyle = /^#[0-9a-f]{6}$/i.test(settings.background??"")?settings.background!:"#ffffff";
      context.fillRect(0, 0, outputWidth, outputHeight);
    }
    context.drawImage(bitmap ?? image!, 0, 0, outputWidth, outputHeight);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Image encoding failed.")),
      OUTPUT_MIME[settings.output], settings.quality / 100,
    ));
    canvas.width = 0;
    canvas.height = 0;
    if (blob.type !== OUTPUT_MIME[settings.output]) throw new Error(`${settings.output.toUpperCase()} encoding is unavailable in this browser.`);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const ended = performance.now();
    onMetrics?.({ decodeMs: decoded - started, encodeMs: ended - decoded, totalMs: ended - started, inputBytes: file.size, outputBytes: blob.size, pixels: outputWidth * outputHeight });
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
