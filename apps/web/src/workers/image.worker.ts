type ImageWorkerRequest = { file: File; mime: string; quality: number; maxPixels: number };

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    self.postMessage({ stage: "decoding" });
    bitmap = await createImageBitmap(event.data.file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > event.data.maxPixels) {
      throw new Error("Image is too large to decode safely (80 megapixel limit).");
    }
    self.postMessage({ stage: "encoding" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    if (event.data.mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, bitmap.width, bitmap.height);
    }
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: event.data.mime, quality: event.data.quality });
    if (blob.type !== event.data.mime) throw new Error("This browser does not support the selected output format.");
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Image conversion failed." });
  } finally {
    bitmap?.close();
  }
};
