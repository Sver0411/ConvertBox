import { Unzip, UnzipInflate, zipSync } from "fflate";
import { uniqueFilename } from "@core/filename";

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 1000;
export interface ArchiveEntry { name: string; compressed: number; size: number; crc: number }

export function safeArchivePath(name: string): string {
  if (!name || name.length > 512 || /[\x00-\x1f\\]/.test(name) || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").some(part => part === ".." || part === ".")) throw new Error("Archive contains an unsafe path.");
  return name;
}

export function archiveDirectory(bytes: Uint8Array): ArchiveEntry[] {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("Archive exceeds 64 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
  }
  if (end < 0) throw new Error("Invalid ZIP directory.");
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 65535 || count > MAX_ARCHIVE_ENTRIES || offset + directorySize !== end) throw new Error("Multi-part, ZIP64 or oversized ZIP is unsupported.");
  const result: ArchiveEntry[] = [], names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid ZIP entry.");
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true), mode = view.getUint32(offset + 38, true) >>> 16;
    if (flags & 1 || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000 || offset + 46 + nameLength + extraLength + commentLength > end) throw new Error("Encrypted, symbolic-link or unsupported ZIP entry.");
    const name = safeArchivePath(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    if (names.has(name)) throw new Error("ZIP contains duplicate paths.");
    names.add(name);
    if (localOffset + 30 > end || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Invalid ZIP local header.");
    const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true);
    const localName = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength));
    if (localName !== name || localOffset + 30 + localNameLength + localExtraLength + compressed > end) throw new Error("ZIP headers do not match.");
    total += size;
    if (total > MAX_ARCHIVE_BYTES || size > MAX_ARCHIVE_BYTES || compressed === 0xffffffff || size === 0xffffffff) throw new Error("Uncompressed ZIP exceeds 64 MB.");
    result.push({ name, compressed, size, crc: view.getUint32(offset + 16, true) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw new Error("Invalid ZIP directory length.");
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function extractZip(bytes: Uint8Array, selected?: string[]): { name: string; blob: Blob }[] {
  const directory = archiveDirectory(bytes);
  const entries = new Map(directory.map(entry => [entry.name, entry]));
  const wanted = new Set(selected ?? directory.filter(entry => !entry.name.endsWith("/")).map(entry => entry.name));
  if ([...wanted].some(name => !entries.has(name))) throw new Error("Selected ZIP entry is missing.");
  const result: { name: string; blob: Blob }[] = [];
  let total = 0;
  const unzip = new Unzip(file => {
    const entry = entries.get(safeArchivePath(file.name));
    if (!entry) throw new Error("Unexpected ZIP entry.");
    if (!wanted.has(file.name) || file.name.endsWith("/")) return;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.byteLength; total += chunk.byteLength;
      if (size > entry.size || total > MAX_ARCHIVE_BYTES) throw new Error("ZIP expansion exceeds declared size.");
      chunks.push(chunk);
      if (final) {
        const all = new Uint8Array(size); let cursor = 0;
        for (const part of chunks) { all.set(part, cursor); cursor += part.length; }
        if (size !== entry.size || crc32(all) !== entry.crc) throw new Error("ZIP entry checksum does not match.");
        result.push({ name: file.name, blob: new Blob([all]) });
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 65536) unzip.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length);
  if (result.length !== [...wanted].filter(name => !name.endsWith("/")).length) throw new Error("ZIP extraction is incomplete.");
  return result;
}

export async function createZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  if (files.length > MAX_ARCHIVE_ENTRIES || files.reduce((sum, file) => sum + file.blob.size, 0) > MAX_ARCHIVE_BYTES) throw new Error("ZIP input exceeds 64 MB or 1000 entries.");
  const entries: Record<string, Uint8Array> = Object.create(null);
  const used = new Set<string>();
  for (const file of files) entries[uniqueFilename(safeArchivePath(file.name).split("/").pop()!, used)] = new Uint8Array(await file.blob.arrayBuffer());
  return new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], { type: "application/zip" });
}

export function renamedFiles(files: File[], settings: Record<string, unknown>): { name: string; blob: Blob }[] {
  const used = new Set<string>();
  return files.map((file, index) => {
    const dot = file.name.lastIndexOf(".");
    let stem = dot > 0 ? file.name.slice(0, dot) : file.name, extension = dot > 0 ? file.name.slice(dot) : "";
    const mode = settings.mode ?? "prefix";
    if (mode === "sequence") stem = `${String(settings.prefix ?? "file_")}${String(index + Number(settings.start ?? 1)).padStart(3, "0")}`;
    else if (mode === "replace") stem = stem.split(String(settings.find ?? "")).join(String(settings.replace ?? ""));
    else if (mode === "lowercase") { stem = stem.toLowerCase(); extension = extension.toLowerCase(); }
    else if (mode === "uppercase") { stem = stem.toUpperCase(); extension = extension.toUpperCase(); }
    else if (mode === "date") stem = `${String(settings.date ?? new Date().toISOString().slice(0, 10))}_${stem}`;
    else stem = `${String(settings.prefix ?? "")}${stem}${String(settings.suffix ?? "")}`;
    const name = `${stem}${extension}`.replace(/[\x00-\x1f/\\<>:"|?*]/g, "_").slice(0, 200);
    return { name: uniqueFilename(name || `file_${index + 1}`, used), blob: file };
  });
}
