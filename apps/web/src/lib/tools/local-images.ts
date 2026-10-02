import { detectFileType } from "@detection/detect";
import { browserCanEncode, convertImage } from "@/lib/image-converter";
import { DEFAULT_LOCAL_MEMORY_BUDGET, estimatedImageBytes, LocalImageScheduler } from "@/lib/local-scheduler";
import type { ImageFormat } from "@shared/index";

const scheduler = new LocalImageScheduler(DEFAULT_LOCAL_MEMORY_BUDGET);

export async function editImage(file: File, toolId: string, settings: Record<string, unknown>, signal: AbortSignal): Promise<Blob> {
  const descriptor = await detectFileType(file);
  if (descriptor.error) throw new Error(descriptor.error);
  if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds the 25 MB local limit.");
  const format = String(settings.output ?? "png") as ImageFormat;
  if (!["jpg", "png", "webp"].includes(format) || !browserCanEncode(format)) throw new Error("This browser does not support the selected output format.");
  const cost = estimatedImageBytes(descriptor, { output: format, quality: Number(settings.quality ?? 85) });
  return scheduler.run(cost, signal, async () => {
    if (toolId === "image.compress" || toolId === "image.strip-metadata") return convertImage(file, { output: format, quality: Number(settings.quality ?? 85) }, () => {}, signal);
    const image = await createImageBitmap(file);
    let canvas: HTMLCanvasElement | null = null;
    try {
      const rotation = Number(settings.rotation ?? 0);
      if (![0, 90, 180, 270].includes(rotation)) throw new Error("Invalid rotation.");
      canvas = document.createElement("canvas");
      canvas.width = rotation % 180 ? image.height : image.width;
      canvas.height = rotation % 180 ? image.width : image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      if (format === "jpg") { context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      if (toolId === "image.flip") context.scale(settings.direction === "horizontal" ? -1 : 1, settings.direction === "vertical" ? -1 : 1);
      context.drawImage(image, -image.width / 2, -image.height / 2);
      if (toolId === "image.crop") {
        const x = Math.round(Number(settings.crop_x ?? 0)), y = Math.round(Number(settings.crop_y ?? 0));
        const width = Math.round(Number(settings.crop_width ?? canvas.width)), height = Math.round(Number(settings.crop_height ?? canvas.height));
        if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width < 1 || height < 1 || x + width > canvas.width || y + height > canvas.height) throw new Error("Invalid crop area.");
        const cropped = document.createElement("canvas");
        cropped.width = width; cropped.height = height;
        cropped.getContext("2d")!.drawImage(canvas, x, y, width, height, 0, 0, width, height);
        canvas.width = canvas.height = 0;
        canvas = cropped;
      }
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const mime = format === "jpg" ? "image/jpeg" : `image/${format}`;
      const blob = await new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value && value.type === mime ? resolve(value) : reject(new Error("Image could not be encoded.")), mime, Number(settings.quality ?? 85) / 100));
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      return blob;
    } finally { image.close(); if (canvas) canvas.width = canvas.height = 0; }
  });
}
