import type { FileDescriptor } from "@shared/index";

export type ToolView = "all" | "image" | "pdf" | "word" | "audio" | "video" | "history" | "about";
export type ConversionView = Exclude<ToolView, "history" | "about">;

export const conversionViews: ConversionView[] = ["all", "image", "pdf", "word", "audio", "video"];
export const toolViews: ToolView[] = [...conversionViews, "history", "about"];

export function isConversionView(view: ToolView): view is ConversionView {
  return view !== "history" && view !== "about";
}

export function viewAccepts(view: ConversionView, descriptor: FileDescriptor): boolean {
  const type = descriptor.detectedType;
  if (view === "all") return true;
  if (view === "image") return descriptor.category === "image";
  if (view === "pdf") return descriptor.category === "pdf" || descriptor.category === "image";
  if (view === "word") return ["doc", "docx", "odt", "pdf"].includes(type);
  if (view === "audio") return descriptor.category === "audio" || descriptor.category === "video";
  return descriptor.category === "video";
}

export function viewOutputs(view: ConversionView, descriptor: FileDescriptor, options: string[]): string[] {
  if (view === "image") return options.filter(item => ["jpg", "png", "webp", "avif"].includes(item));
  if (view === "pdf" && descriptor.category === "image") return options.filter(item => item === "pdf");
  if (view === "pdf" && descriptor.category === "pdf") return options.filter(item => ["png", "jpg", "txt"].includes(item));
  if (view === "word") return options.filter(item => item === (descriptor.detectedType === "pdf" ? "docx" : "pdf"));
  if (view === "audio" && descriptor.category === "video") return options.filter(item => item === "mp3" || item === "wav");
  if (view === "video") return options.filter(item => ["mp4", "webm", "mkv"].includes(item));
  return options;
}

export function preferredOutput(view: ConversionView, descriptor: FileDescriptor, options: string[], current: string): string {
  const preferred = view === "pdf" && descriptor.category === "image" ? "pdf"
    : view === "word" ? descriptor.detectedType === "pdf" ? "docx" : "pdf"
    : view === "audio" && descriptor.category === "video" ? "mp3"
    : view === "video" ? "mp4" : current;
  return options.includes(preferred) ? preferred : options[0] ?? "";
}

export const viewInputAccept: Record<ConversionView, string> = {
  all: "", image: "image/*,.heic,.heif,.avif,.bmp,.gif", pdf: ".pdf,image/*,.heic,.heif,.avif", word: ".doc,.docx,.odt,.pdf", audio: "audio/*,video/*", video: "video/*,.mkv,.avi",
};
