import type { JobStatus } from "@shared/index";

export type Language = "zh" | "en";

export const copy = {
  zh: {
    convert: "转换", about: "说明", localBadge: "本地处理", heroTitle: "文件转换", heroSub: "JPG、PNG、WebP 图片转换。文件不会上传。",
    dropTitle: "拖入图片", dropSub: "或从设备中选择", chooseFiles: "选择文件", workspace: "工作区", yourFiles: "文件",
    addFiles: "添加文件", readyCount: (n: number) => `${n} 个待转换`, completeCount: (n: number) => `${n} 个已完成`,
    unsupportedCount: (n: number) => `${n} 个不支持`, convertTo: "目标格式", quality: "画质",
    pngQuality: "PNG 为无损格式，此设置不生效。", otherQuality: "画质越高，文件通常越大。",
    localTitle: "仅在浏览器中处理", localDetail: "图片不会上传到服务器。", convertProgress: "正在转换",
    completeSummary: (n: number) => `${n} 个已完成`, failedSummary: (n: number) => `${n} 个失败`,
    ready: "可以开始转换", addSupported: "请添加 JPG、PNG 或 WebP 图片", downloadAll: "下载全部",
    zipLimit: "结果超过 200 MB，请逐个下载", converting: "转换中…", convertRemaining: "转换剩余文件", convertFiles: "开始转换",
    status: { CREATED: "待转换", VALIDATING: "检查中", QUEUED: "排队中", PROCESSING: "处理中", COMPLETED: "已完成", FAILED: "失败", CANCELLED: "已取消" } satisfies Record<JobStatus, string>,
    decoding: "解码中", encoding: "编码中", download: "下载", cancel: "取消", retry: "重试", remove: "移除",
    aboutTitle: "关于 ConvertBox", aboutText: "目前支持 JPG、PNG、WebP 图片互转。转换在浏览器本地完成，文件不会上传，也不会保存到服务器。",
    aboutLimits: "单个文件上限 25 MB；批量最多 100 个文件；ZIP 下载上限 200 MB。",
    footer: "开源文件转换工具", dropOverlay: "松开以添加文件", limit: "每批最多添加 100 个文件。",
    partial: (n: number) => `本次仅添加前 ${n} 个文件（总上限 100 个）。`, zipError: "无法生成 ZIP，请逐个下载。",
    errorSignature: "无法识别文件内容。仅支持 JPG、PNG、WebP。", errorMismatch: "文件扩展名或类型与实际内容不一致。",
    errorSize: "文件超过 25 MB 本地处理上限。", errorPixels: "图片像素超过 8000 万，无法安全处理。",
    errorEncode: "当前浏览器不支持此输出格式。", errorDecode: "无法解码图片。文件可能损坏，或浏览器不支持其编码。",
    errorGeneric: "转换失败，请检查文件后重试。",
  },
  en: {
    convert: "Convert", about: "About", localBadge: "Local processing", heroTitle: "File conversion", heroSub: "Convert JPG, PNG and WebP. Your files stay on your device.",
    dropTitle: "Drop images here", dropSub: "or choose files from your device", chooseFiles: "Choose files", workspace: "Workspace", yourFiles: "Files",
    addFiles: "Add files", readyCount: (n: number) => `${n} ready to convert`, completeCount: (n: number) => `${n} completed`,
    unsupportedCount: (n: number) => `${n} unsupported`, convertTo: "Convert to", quality: "Quality",
    pngQuality: "PNG is lossless; quality does not apply.", otherQuality: "Higher quality usually means a larger file.",
    localTitle: "Processed in your browser", localDetail: "Images are never uploaded.", convertProgress: "Converting",
    completeSummary: (n: number) => `${n} completed`, failedSummary: (n: number) => `${n} failed`,
    ready: "Ready to convert", addSupported: "Add a JPG, PNG or WebP image", downloadAll: "Download all",
    zipLimit: "Results exceed 200 MB; download individually", converting: "Converting…", convertRemaining: "Convert remaining", convertFiles: "Convert files",
    status: { CREATED: "Ready", VALIDATING: "Checking", QUEUED: "Queued", PROCESSING: "Processing", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled" } satisfies Record<JobStatus, string>,
    decoding: "Decoding", encoding: "Encoding", download: "Download", cancel: "Cancel", retry: "Retry", remove: "Remove",
    aboutTitle: "About ConvertBox", aboutText: "ConvertBox currently converts JPG, PNG and WebP images in your browser. Files are never uploaded or stored on a server.",
    aboutLimits: "Limit: 25 MB per file, 100 files per batch, 200 MB for ZIP downloads.",
    footer: "Open source file conversion", dropOverlay: "Drop to add files", limit: "Maximum 100 files per batch.",
    partial: (n: number) => `Only the first ${n} files were added (100-file limit).`, zipError: "Could not create ZIP. Download files individually.",
    errorSignature: "File contents are not a supported JPG, PNG or WebP image.", errorMismatch: "File extension or MIME type does not match its contents.",
    errorSize: "File exceeds the 25 MB local limit.", errorPixels: "Image exceeds the 80-megapixel safety limit.",
    errorEncode: "This browser does not support the selected output format.", errorDecode: "This image could not be decoded. It may be damaged or use an unsupported codec.",
    errorGeneric: "Conversion failed. Check the file and retry.",
  },
};

export function localizeError(error: string, language: Language): string {
  const t = copy[language];
  if (error.startsWith("File signature")) return t.errorSignature;
  if (error.startsWith("File extension") || error.startsWith("File MIME")) return t.errorMismatch;
  if (error.startsWith("File exceeds")) return t.errorSize;
  if (error.includes("80 megapixel")) return t.errorPixels;
  if (error.includes("encoding is unavailable") || error.includes("does not support the selected output")) return t.errorEncode;
  if (error.includes("decode") || error.includes("bitmap")) return t.errorDecode;
  return t.errorGeneric;
}
