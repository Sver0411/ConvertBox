export interface ImageDimensions { width: number; height: number }

export async function readImageDimensions(file: File, type: string): Promise<ImageDimensions | null> {
  if (type === "png") {
    const b = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    if (b.length < 24 || String.fromCharCode(...b.slice(12, 16)) !== "IHDR") return null;
    const view = new DataView(b.buffer);
    return valid(view.getUint32(16), view.getUint32(20));
  }
  if (type === "webp") {
    const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (b.length < 30) return null;
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === "VP8X") return valid(1 + b[24] + (b[25] << 8) + (b[26] << 16), 1 + b[27] + (b[28] << 8) + (b[29] << 16));
    if (chunk === "VP8 ") return valid((b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff);
    if (chunk === "VP8L" && b[20] === 0x2f) return valid(1 + b[21] + ((b[22] & 0x3f) << 8), 1 + (b[22] >> 6) + (b[23] << 2) + ((b[24] & 0x0f) << 10));
    return null;
  }
  if (type === "jpg") {
    const b = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
    let offset = 2;
    while (offset + 9 <= b.length) {
      if (b[offset] !== 0xff) return null;
      while (b[offset] === 0xff) offset++;
      const marker = b[offset++];
      if (marker === 0xda || marker === 0xd9) return null;
      if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) continue;
      if (offset + 2 > b.length) return null;
      const length = b[offset] << 8 | b[offset + 1];
      if (length < 2 || offset + length > b.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return valid(b[offset + 5] << 8 | b[offset + 6], b[offset + 3] << 8 | b[offset + 4]);
      }
      offset += length;
    }
  }
  return null;
}

function valid(width: number, height: number): ImageDimensions | null {
  return width > 0 && height > 0 && width <= 100_000 && height <= 100_000 ? { width, height } : null;
}
