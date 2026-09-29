export interface Preset {
  id: string;
  name: string;
  category: "image" | "audio" | "video";
  output: string;
  quality: number;
  width: number;
  height: number;
  bitrate: number;
  resolution: number;
  videoQuality: string;
  keepMetadata: boolean;
  custom?: boolean;
}

export const defaultPresets: Preset[] = [
  { id: "web-image", name: "Web JPG", category: "image", output: "jpg", quality: 82, width: 1920, height: 0, bitrate: 192, resolution: 0, videoQuality: "high", keepMetadata: false },
  { id: "small-image", name: "Small WebP", category: "image", output: "webp", quality: 70, width: 1600, height: 0, bitrate: 192, resolution: 0, videoQuality: "high", keepMetadata: false },
  { id: "max-image", name: "Full quality PNG", category: "image", output: "png", quality: 100, width: 0, height: 0, bitrate: 192, resolution: 0, videoQuality: "high", keepMetadata: false },
  { id: "video-1080", name: "1080p MP4", category: "video", output: "mp4", quality: 85, width: 0, height: 0, bitrate: 192, resolution: 1080, videoQuality: "high", keepMetadata: false },
  { id: "audio-mp3", name: "MP3 192 kbps", category: "audio", output: "mp3", quality: 85, width: 0, height: 0, bitrate: 192, resolution: 0, videoQuality: "high", keepMetadata: false },
];

export const chinesePresetNames: Record<string, string> = {
  "web-image": "网页 JPG",
  "small-image": "小体积 WebP",
  "max-image": "无损 PNG",
  "video-1080": "1080p MP4",
  "audio-mp3": "MP3 192 kbps",
};

const KEY = "convertbox-presets-v1";

export function loadCustomPresets(): Preset[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Preset => typeof item === "object" && item !== null &&
      typeof item.id === "string" && typeof item.name === "string" && item.name.length <= 50 &&
      ["image", "audio", "video"].includes(item.category) && typeof item.output === "string" &&
      typeof item.quality === "number" && typeof item.width === "number" && typeof item.height === "number" &&
      typeof item.bitrate === "number" && typeof item.resolution === "number" && typeof item.videoQuality === "string" && typeof item.keepMetadata === "boolean" && item.custom === true).slice(0, 20);
  } catch { return []; }
}

export function storeCustomPresets(presets: Preset[]): void {
  localStorage.setItem(KEY, JSON.stringify(presets.slice(0, 20)));
}
