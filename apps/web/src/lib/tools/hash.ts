import { createMD5, createSHA1, createSHA256 } from "hash-wasm";

export async function hashFile(file: Blob, algorithm: string, signal: AbortSignal, onProgress: (value: number) => void = () => {}): Promise<string> {
  const hasher = algorithm === "md5" ? await createMD5() : algorithm === "sha1" ? await createSHA1() : algorithm === "sha256" ? await createSHA256() : null;
  if (!hasher) throw new Error("Unsupported hash algorithm.");
  hasher.init();
  for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    hasher.update(new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer()));
    onProgress(Math.min(1, (offset + 1024 * 1024) / file.size));
  }
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  onProgress(1);
  return hasher.digest("hex");
}
