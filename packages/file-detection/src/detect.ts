import { CAPABILITIES } from "@core/capabilities";
import type { FileCategory, FileDescriptor, ImageFormat, Signature } from "@shared/index";

const mimeToFormat: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heic", "image/avif": "avif", "application/pdf": "pdf",
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
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WAVE") return "wav";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "AVI ") return "avi";
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF") return "pdf";
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "fLaC") return "flac";
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "OggS") return "ogg";
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "PK\x03\x04") return "zip";
  if (bytes.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((v, i) => bytes[i] === v)) return "ole";
  if (bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === "\x1a\x45\xdf\xa3") return "ebml";
  if (bytes.length >= 6 && [71, 73, 70, 56].every((v, i) => bytes[i] === v)) return "gif";
  if (bytes.length >= 2 && bytes[0] === 66 && bytes[1] === 77) return "bmp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (brand.startsWith("hei") || brand.startsWith("mif")) return "heic";
    if (brand === "avif" || brand === "avis") return "avif";
    if (brand.startsWith("m4a")) return "m4a";
    return "mp4";
  }
  if (bytes.length >= 3 && String.fromCharCode(...bytes.slice(0, 3)) === "ID3") return "mp3";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mpeg-audio";
  return "unknown";
}

const categories: Record<string, FileCategory> = {
  jpg: "image", png: "image", webp: "image", bmp: "image", gif: "image", heic: "image", avif: "image",
  pdf: "pdf", doc: "office", docx: "office", odt: "office", xls: "office", xlsx: "office", ods: "office", ppt: "office", pptx: "office", odp: "office",
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", m4a: "audio", ogg: "audio", opus: "audio",
  mp4: "video", mov: "video", mkv: "video", webm: "video", avi: "video",
};

function resolveSignature(signature: Signature, extension: string): string {
  if (signature === "zip" && ["docx", "xlsx", "pptx", "odt", "ods", "odp"].includes(extension)) return extension;
  if (signature === "ole" && ["doc", "xls", "ppt"].includes(extension)) return extension;
  if (signature === "ebml" && ["mkv", "webm"].includes(extension)) return extension;
  if (signature === "mpeg-audio" && ["mp3", "aac"].includes(extension)) return extension;
  if (signature === "ogg" && extension === "opus") return "opus";
  if (signature === "mp4" && extension === "mov") return "mov";
  if (signature === "heic" && extension === "heif") return "heic";
  return signature;
}

export async function detectFileType(file: File): Promise<FileDescriptor> {
  const extension = extensionOf(file.name);
  const expected = normalizeExtension(extension);
  const mime = file.type.toLowerCase();
  const signature = signatureOf(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  const detectedType = resolveSignature(signature, extension);
  let error: string | undefined;
  if (signature === "unknown") error = "Unsupported or unrecognized file signature.";
  else if (extension && extension !== detectedType && !(expected && expected === detectedType) && !(extension === "heif" && detectedType === "heic")) error = `File extension says ${extension.toUpperCase()}, but contents are ${detectedType.toUpperCase()}.`;
  else if (mimeToFormat[mime] && mimeToFormat[mime] !== detectedType) error = `File MIME type says ${mimeToFormat[mime].toUpperCase()}, but contents are ${detectedType.toUpperCase()}.`;
  const category = error ? "unsupported" : categories[detectedType] ?? "unsupported";
  return {
    name: file.name, extension, mime, detectedType, size: file.size,
    category, signature,
    supportedConversions: category === "image" && detectedType in CAPABILITIES ? CAPABILITIES[detectedType as ImageFormat] : [],
    error,
  };
}
