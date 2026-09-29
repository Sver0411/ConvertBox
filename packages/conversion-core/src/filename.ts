import type { ImageFormat } from "@shared/index";

export function safeBaseName(name: string): string {
  const leaf = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const stem = leaf.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_").trim();
  return stem.slice(0, 120) || "file";
}

export function outputFilename(inputName: string, format: ImageFormat): string {
  return `${safeBaseName(inputName)}.${format}`;
}

export function uniqueFilename(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  let suffix = 1;
  while (used.has(candidate.toLowerCase())) candidate = `${stem}_${suffix++}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
