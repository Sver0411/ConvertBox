import { CAPABILITIES } from "@core/capabilities";
import type { FileDescriptor, ImageFormat, Signature } from "@shared/index";

const mimeToFormat: Record<string, ImageFormat> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export function extensionOf(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function normalizeExtension(extension: string): ImageFormat | null {
  if (extension === "jpeg" || extension === "jpg") return "jpg";
  if (extension === "png" || extension === "webp") return extension;
  return null;
}

export function signatureOf(bytes: Uint8Array): Signature {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return "unknown";
}

export async function detectFileType(file: File): Promise<FileDescriptor> {
  const extension = extensionOf(file.name);
  const expected = normalizeExtension(extension);
  const mime = file.type.toLowerCase();
  const signature = signatureOf(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  let error: string | undefined;
  if (signature === "unknown") error = "File signature is not a supported JPG, PNG or WebP image.";
  else if (expected && expected !== signature) error = `File extension says ${expected.toUpperCase()}, but contents are ${signature.toUpperCase()}.`;
  else if (mimeToFormat[mime] && mimeToFormat[mime] !== signature) error = `File MIME type says ${mimeToFormat[mime].toUpperCase()}, but contents are ${signature.toUpperCase()}.`;
  const category = !error && signature !== "unknown" ? "image" : "unsupported";
  return {
    name: file.name, extension, mime, detectedType: signature, size: file.size,
    category, signature,
    supportedConversions: category === "image" ? CAPABILITIES[signature as ImageFormat] : [],
    error,
  };
}
