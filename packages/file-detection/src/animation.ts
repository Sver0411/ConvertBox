// Small container-header scan; rejects uncertain oversized headers.

const MAX_SCAN_BYTES = 16 * 1024 * 1024;

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

export async function animationKind(file: File, type: string): Promise<"webp" | "apng" | "gif" | null> {
  if (type === "gif") return null; // The server checks n_frames before converting.
  if (type === "png") {
    let offset = 8;
    while (offset + 12 <= file.size && offset < MAX_SCAN_BYTES) {
      const header = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer());
      const length = new DataView(header.buffer).getUint32(0);
      const chunk = ascii(header.slice(4, 8));
      if (chunk === "acTL") return "apng";
      if (chunk === "IDAT" || chunk === "IEND") return null;
      if (length > file.size - offset - 12) return null;
      offset += 12 + length;
    }
    if (offset >= MAX_SCAN_BYTES) return "apng";
  }
  if (type === "webp") {
    let offset = 12;
    while (offset + 8 <= file.size && offset < MAX_SCAN_BYTES) {
      const header = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer());
      const chunk = ascii(header.slice(0, 4));
      const length = new DataView(header.buffer).getUint32(4, true);
      if (chunk === "ANIM" || chunk === "ANMF") return "webp";
      if (chunk === "VP8X" && length >= 1) {
        const flags = new Uint8Array(await file.slice(offset + 8, offset + 9).arrayBuffer())[0];
        if (flags & 0x02) return "webp";
      }
      if (length > file.size - offset - 8) return null;
      offset += 8 + length + (length & 1);
    }
    if (offset >= MAX_SCAN_BYTES) return "webp";
  }
  return null;
}
