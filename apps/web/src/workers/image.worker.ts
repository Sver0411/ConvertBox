import { outputDimensions } from "@core/dimensions";

type ImageWorkerRequest = { background?:string; file: File; mime: string; quality: number; maxPixels: number; width: number; height: number };

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  let bitmap: ImageBitmap | undefined;
  const started = performance.now();
  try {
    self.postMessage({ stage: "decoding" });
    bitmap = await createImageBitmap(event.data.file);
    const decoded = performance.now();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > event.data.maxPixels) {
      throw new Error("Image is too large to decode safely (80 megapixel limit).");
    }
    self.postMessage({ stage: "encoding" });
    const [width, height] = outputDimensions(bitmap.width, bitmap.height, event.data.width, event.data.height);
    if (width * height > event.data.maxPixels) throw new Error("Output image is too large (80 megapixel limit).");
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    if (event.data.mime === "image/jpeg") {
      context.fillStyle = /^#[0-9a-f]{6}$/i.test(event.data.background??"")?event.data.background!:"#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: event.data.mime, quality: event.data.quality });
    if (blob.type !== event.data.mime) throw new Error("This browser does not support the selected output format.");
    const ended = performance.now();
    self.postMessage({ blob, metrics: { decodeMs: decoded - started, encodeMs: ended - decoded, totalMs: ended - started, inputBytes: event.data.file.size, outputBytes: blob.size, pixels: width * height } });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Image conversion failed." });
  } finally {
    bitmap?.close();
  }
};
