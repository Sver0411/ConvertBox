import type { JobStatus } from "@shared/index";

export type Language = "zh" | "en";

export const copy = {
  zh: {
    convert: "转换", history: "历史", about: "说明", theme: "主题", themeLight: "浅色", themeDark: "深色", themeSystem: "系统", localBadge: "本地处理", serverBadge: "含服务器处理", heroTitle: "文件转换", heroSub: "图片、PDF、Office、音频与视频。处理位置会在转换前标明。",
    dropTitle: "拖入文件", dropSub: "或从设备中选择", chooseFiles: "选择文件", workspace: "工作区", yourFiles: "文件",
    addFiles: "添加文件", readyCount: (n: number) => `${n} 个待转换`, completeCount: (n: number) => `${n} 个已完成`,
    unsupportedCount: (n: number) => `${n} 个不支持`, convertTo: "目标格式", quality: "画质",
    pngQuality: "PNG 为无损格式，此设置不生效。", otherQuality: "画质越高，文件通常越大。",
    localTitle: "仅在浏览器中处理", localDetail: "文件不会上传。", serverTitle: "需要服务器处理", serverDetail: "所选任务会临时上传，结果 1 小时后删除。", convertProgress: "正在转换",
    completeSummary: (n: number) => `${n} 个已完成`, failedSummary: (n: number) => `${n} 个失败`,
    ready: "可以开始转换", addSupported: "请选择支持的文件", downloadAll: "下载全部",
    zipLimit: "结果超过 200 MB，请逐个下载", converting: "转换中…", convertRemaining: "转换剩余文件", convertFiles: "开始转换",
    status: { CREATED: "待转换", VALIDATING: "检查中", QUEUED: "排队中", PROCESSING: "处理中", COMPLETED: "已完成", FAILED: "失败", CANCELLED: "已取消" } satisfies Record<JobStatus, string>,
    decoding: "解码中", encoding: "编码中", download: "下载", cancel: "取消", retry: "重试", remove: "移除",
    aboutTitle: "关于 ConvertBox", aboutText: "JPG、PNG、WebP 的普通转换和尺寸调整在本地完成。PDF、Office、其他图片格式及音视频需要服务器处理；上传文件和结果在 1 小时后删除。",
    aboutLimits: "本地图片上限 25 MB；批量最多 100 个文件。PDF 转 DOCX 仅提取可选择的文字，不保留原排版。",
    footer: "开源文件转换工具", dropOverlay: "松开以添加文件", dropFormats: "图片 · PDF · Office · 音频 · 视频", limit: "每批最多添加 100 个文件。",
    partial: (n: number) => `本次仅添加前 ${n} 个文件（总上限 100 个）。`, zipError: "无法生成 ZIP，请逐个下载。", serverUnavailable: "服务器转换暂时不可用，请稍后重试。",
    width: "宽度（像素）", height: "高度（像素）", original: "原尺寸", resizeHint: "只填一项时保持比例；两项都填时等比放入指定尺寸。", metadata: "元数据", removeMetadata: "移除", keepMetadata: "保留 EXIF / 色彩配置（服务器）", preset: "预设", choosePreset: "选择预设", savePreset: "保存当前设置", deletePreset: "删除预设", presetName: "预设名称", save: "保存", moveUp: "上移", moveDown: "下移", localShort: "本地", serverShort: "服务器", sizeChange: (percent: number) => percent >= 0 ? `缩小 ${percent}%` : `增大 ${-percent}%`,
    pdfAction: "PDF 操作", pdfConvert: "转换格式", pdfSplit: "拆分页面", pdfRotate: "旋转页面", pdfCompress: "优化文件", pdfMerge: "合并 PDF", imagesToPdf: "合并为 PDF", pages: "页码", rotation: "旋转角度", pageSize: "页面尺寸", orientation: "方向", margin: "边距", auto: "自动", portrait: "纵向", landscape: "横向", none: "无", small: "小", medium: "中", large: "大", audioBitrate: "音频码率", sampleRate: "采样率", resolution: "分辨率", veryHigh: "极高", high: "高", low: "低", textOnly: "（仅文本）", groupResult: "合并结果", uploading: "上传中", processing: "处理中",
    errorSignature: "无法识别文件内容或该格式暂不支持。", errorMismatch: "文件扩展名或类型与实际内容不一致。",
    errorSize: "文件超出当前处理大小限制。", errorPixels: "图片像素超过 8000 万，无法安全处理。",
    errorEncode: "当前浏览器不支持此输出格式。", errorDecode: "无法解码图片。文件可能损坏，或浏览器不支持其编码。",
    errorNoText: "PDF 中没有可选择的文字；扫描件需要 OCR。", errorProtected: "暂不支持加密 PDF。", errorServer: "服务器处理失败，请检查文件后重试。", errorRange: "页码范围不在文件页数内。", errorOffice: "Office 文件无法转换为 PDF。",
    errorGeneric: "转换失败，请检查文件后重试。",
  },
  en: {
    convert: "Convert", history: "History", about: "About", theme: "Theme", themeLight: "Light", themeDark: "Dark", themeSystem: "System", localBadge: "Local processing", serverBadge: "Server processing", heroTitle: "File conversion", heroSub: "Images, PDF, Office, audio and video. Processing location is shown before conversion.",
    dropTitle: "Drop files here", dropSub: "or choose files from your device", chooseFiles: "Choose files", workspace: "Workspace", yourFiles: "Files",
    addFiles: "Add files", readyCount: (n: number) => `${n} ready to convert`, completeCount: (n: number) => `${n} completed`,
    unsupportedCount: (n: number) => `${n} unsupported`, convertTo: "Convert to", quality: "Quality",
    pngQuality: "PNG is lossless; quality does not apply.", otherQuality: "Higher quality usually means a larger file.",
    localTitle: "Processed in your browser", localDetail: "Files are never uploaded.", serverTitle: "Server processing required", serverDetail: "Selected files are uploaded temporarily and deleted after one hour.", convertProgress: "Converting",
    completeSummary: (n: number) => `${n} completed`, failedSummary: (n: number) => `${n} failed`,
    ready: "Ready to convert", addSupported: "Choose a supported file", downloadAll: "Download all",
    zipLimit: "Results exceed 200 MB; download individually", converting: "Converting…", convertRemaining: "Convert remaining", convertFiles: "Convert files",
    status: { CREATED: "Ready", VALIDATING: "Checking", QUEUED: "Queued", PROCESSING: "Processing", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled" } satisfies Record<JobStatus, string>,
    decoding: "Decoding", encoding: "Encoding", download: "Download", cancel: "Cancel", retry: "Retry", remove: "Remove",
    aboutTitle: "About ConvertBox", aboutText: "Basic JPG, PNG and WebP conversion and resizing run locally. PDF, Office, other images, audio and video use the server; uploads and results are deleted after one hour.",
    aboutLimits: "Local images: 25 MB each; batches: 100 files. PDF to DOCX extracts selectable text only and does not preserve layout.",
    footer: "Open source file conversion", dropOverlay: "Drop to add files", dropFormats: "Images · PDF · Office · Audio · Video", limit: "Maximum 100 files per batch.",
    partial: (n: number) => `Only the first ${n} files were added (100-file limit).`, zipError: "Could not create ZIP. Download files individually.", serverUnavailable: "Server conversion is unavailable. Retry later.",
    width: "Width (pixels)", height: "Height (pixels)", original: "Original", resizeHint: "One dimension preserves aspect ratio; two fit within the given size.", metadata: "Metadata", removeMetadata: "Remove", keepMetadata: "Keep EXIF / color profile (server)", preset: "Preset", choosePreset: "Choose preset", savePreset: "Save current settings", deletePreset: "Delete preset", presetName: "Preset name", save: "Save", moveUp: "Move up", moveDown: "Move down", localShort: "Local", serverShort: "Server", sizeChange: (percent: number) => percent >= 0 ? `${percent}% smaller` : `${-percent}% larger`,
    pdfAction: "PDF action", pdfConvert: "Convert format", pdfSplit: "Split pages", pdfRotate: "Rotate pages", pdfCompress: "Optimize file", pdfMerge: "Merge PDF", imagesToPdf: "Combine into PDF", pages: "Pages", rotation: "Rotation", pageSize: "Page size", orientation: "Orientation", margin: "Margin", auto: "Auto", portrait: "Portrait", landscape: "Landscape", none: "None", small: "Small", medium: "Medium", large: "Large", audioBitrate: "Audio bitrate", sampleRate: "Sample rate", resolution: "Resolution", veryHigh: "Very high", high: "High", low: "Low", textOnly: " (text only)", groupResult: "Combined result", uploading: "Uploading", processing: "Processing",
    errorSignature: "File contents are unrecognized or unsupported.", errorMismatch: "File extension or MIME type does not match its contents.",
    errorSize: "File exceeds the current processing limit.", errorPixels: "Image exceeds the 80-megapixel safety limit.",
    errorEncode: "This browser does not support the selected output format.", errorDecode: "This image could not be decoded. It may be damaged or use an unsupported codec.",
    errorNoText: "No selectable text was found in this PDF. Scanned pages need OCR.", errorProtected: "Encrypted PDFs are not supported yet.", errorServer: "Server processing failed. Check the file and retry.", errorRange: "Page range is outside this PDF.", errorOffice: "Office document could not be converted to PDF.",
    errorGeneric: "Conversion failed. Check the file and retry.",
  },
};

export function localizeError(error: string, language: Language): string {
  const t = copy[language];
  if (error.startsWith("File signature") || error.startsWith("Unsupported or unrecognized")) return t.errorSignature;
  if (error.startsWith("File extension") || error.startsWith("File MIME")) return t.errorMismatch;
  if (error.startsWith("File exceeds")) return t.errorSize;
  if (error.startsWith("Server converter")) return t.serverUnavailable;
  if (error.startsWith("No selectable text")) return t.errorNoText;
  if (error.startsWith("Password-protected")) return t.errorProtected;
  if (error.startsWith("Page range")) return t.errorRange;
  if (error.startsWith("Office document")) return t.errorOffice;
  if (error.startsWith("Server conversion")) return t.errorServer;
  if (error.includes("80 megapixel")) return t.errorPixels;
  if (error.includes("encoding is unavailable") || error.includes("does not support the selected output")) return t.errorEncode;
  if (error.includes("decode") || error.includes("bitmap")) return t.errorDecode;
  return t.errorGeneric;
}
