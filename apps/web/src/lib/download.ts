import { zipSync } from "fflate";
import { uniqueFilename } from "@core/filename";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadZip(files: { name: string; blob: Blob }[]): Promise<void> {
  const used = new Set<string>();
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[uniqueFilename(file.name, used)] = new Uint8Array(await file.blob.arrayBuffer());
  const zip = zipSync(entries, { level: 0 });
  const today = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([new Uint8Array(zip)], { type: "application/zip" }), `convertbox_${today}.zip`);
}
