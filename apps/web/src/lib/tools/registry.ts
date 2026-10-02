import { expandedTools, legacySchemas } from "./catalog";
export type ToolCategory = "image" | "pdf" | "document" | "data" | "audio" | "video" | "archive" | "file";
export type ProcessingLocation = "local" | "server" | "hybrid";
export type ToolOutputKind = "file" | "files" | "archive" | "text" | "report";
export type ResourceClass = "light" | "medium" | "heavy";
export type LocalizedText = { zh: string; en: string };

export interface ToolSettingDefinition {
  key: string;
  label: LocalizedText;
  kind: "select" | "number" | "text" | "boolean";
  options?: { value: string; label: LocalizedText }[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
}

export interface ToolDefinition {
  id: `${ToolCategory}.${string}`;
  category: ToolCategory;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  acceptedInputs: string[];
  processing: ProcessingLocation;
  batchSupport: boolean;
  multipleInputSupport: boolean;
  outputKind: ToolOutputKind;
  operation: string;
  estimatedResourceClass: ResourceClass;
  settingsSchema?: ToolSettingDefinition[];
  capability?: string;
  keywords?: string[];
  workspace?: "all" | "image" | "pdf" | "word" | "audio" | "video";
}

export interface ToolExecutionRequest {
  toolId: ToolDefinition["id"];
  files: File[];
  settings: Record<string, unknown>;
}

export type ToolResult =
  | { kind: "batch"; items: ({kind:"file";blob:Blob;name:string}|{kind:"server-file";jobId:string;name:string;size:number})[]; failures:{name:string;error:string}[] }
  | { kind: "server-files"; files: {jobId:string;name:string;size:number}[] }
  | { kind: "server-file"; jobId: string; name: string; size: number }
  | { kind: "file"; blob: Blob; name: string }
  | { kind: "files"; files: { blob: Blob; name: string }[] }
  | { kind: "archive"; blob: Blob; name: string }
  | { kind: "text"; text: string; name?: string }
  | { kind: "report"; fields: { label: string; value: string }[] };

const names = (zh: string, en: string): LocalizedText => ({ zh, en });

const definitions: ToolDefinition[] = [
  ...expandedTools,
  { id: "image.convert", category: "image", name: names("图片格式转换", "Convert images"), description: names("转换 JPG、PNG、WebP 等图片", "Convert JPG, PNG, WebP and more"), icon: "image", acceptedInputs: ["image/*"], processing: "hybrid", batchSupport: true, multipleInputSupport: true, outputKind: "file", operation: "convert", estimatedResourceClass: "medium", keywords: ["jpg", "jpeg", "png", "webp", "heic", "avif"], workspace: "image" },
  { id: "image.resize", category: "image", name: names("调整图片尺寸", "Resize images"), description: names("按宽度或高度缩放图片", "Scale images by width or height"), icon: "resize", acceptedInputs: ["image/*"], processing: "hybrid", batchSupport: true, multipleInputSupport: true, outputKind: "file", operation: "resize", estimatedResourceClass: "medium", keywords: ["尺寸", "width", "height"], workspace: "image" },
  { id: "pdf.convert", category: "pdf", name: names("PDF 转换", "Convert PDF"), description: names("导出图片或提取文字", "Export images or selectable text"), icon: "pdf", acceptedInputs: ["application/pdf"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "convert", estimatedResourceClass: "heavy", workspace: "pdf" },
  { id: "pdf.merge", category: "pdf", name: names("合并 PDF", "Merge PDF"), description: names("按顺序合并多个 PDF", "Combine PDFs in order"), icon: "pdf", acceptedInputs: ["application/pdf"], processing: "server", batchSupport: false, multipleInputSupport: true, outputKind: "file", operation: "merge", estimatedResourceClass: "medium", workspace: "pdf" },
  { id: "pdf.split", category: "pdf", name: names("拆分 PDF", "Split PDF"), description: names("按页码范围拆分 PDF", "Split a PDF by page ranges"), icon: "pdf", acceptedInputs: ["application/pdf"], processing: "server", batchSupport: false, multipleInputSupport: false, outputKind: "archive", operation: "split", estimatedResourceClass: "medium", workspace: "pdf" },
  { id: "pdf.rotate", category: "pdf", name: names("旋转 PDF 页面", "Rotate PDF pages"), description: names("旋转指定页面", "Rotate selected pages"), icon: "pdf", acceptedInputs: ["application/pdf"], processing: "server", batchSupport: false, multipleInputSupport: false, outputKind: "file", operation: "rotate", estimatedResourceClass: "medium", workspace: "pdf" },
  { id: "pdf.compress", category: "pdf", name: names("优化 PDF", "Optimize PDF"), description: names("尝试减小 PDF 文件体积", "Try to reduce PDF file size"), icon: "pdf", acceptedInputs: ["application/pdf"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "compress", estimatedResourceClass: "medium", workspace: "pdf" },
  { id: "document.convert", category: "document", name: names("文档转换", "Convert documents"), description: names("Word、表格、演示文稿转 PDF；PDF 提取为 Word", "Documents to PDF; PDF text to Word"), icon: "document", acceptedInputs: [".pdf", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "convert", estimatedResourceClass: "medium", capability: "office", workspace: "word" },
  { id: "audio.convert", category: "audio", name: names("音频转换", "Convert audio"), description: names("转换常见音频格式", "Convert common audio formats"), icon: "audio", acceptedInputs: ["audio/*"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "convert", estimatedResourceClass: "medium", capability: "audio", workspace: "audio" },
  { id: "video.convert", category: "video", name: names("视频转换", "Convert video"), description: names("转换 MP4、WebM 与 MKV", "Convert MP4, WebM and MKV"), icon: "video", acceptedInputs: ["video/*"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "convert", estimatedResourceClass: "heavy", capability: "video", workspace: "video" },
  { id: "video.extract-audio", category: "video", name: names("提取视频音频", "Extract video audio"), description: names("从视频导出 MP3 或 WAV", "Export MP3 or WAV from video"), icon: "audio", acceptedInputs: ["video/*"], processing: "server", batchSupport: true, multipleInputSupport: false, outputKind: "file", operation: "convert", estimatedResourceClass: "medium", capability: "video", workspace: "audio" },
];

export const toolRegistry: readonly ToolDefinition[] = definitions.map(tool=>({...tool,settingsSchema:tool.settingsSchema??legacySchemas[tool.id],multipleInputSupport:tool.id==='file.hash'?true:tool.multipleInputSupport}));

export const toolCategories: readonly ToolCategory[] = ["image", "pdf", "document", "data", "audio", "video", "archive", "file"];
export const categoryNames: Record<ToolCategory, LocalizedText> = {
  image: names("图片", "Images"), pdf: names("PDF", "PDF"), document: names("文档", "Documents"),
  data: names("数据", "Data"), audio: names("音频", "Audio"), video: names("视频", "Video"),
  archive: names("压缩包", "Archives"), file: names("文件工具", "File tools"),
};

export function getTool(id: string): ToolDefinition | undefined { return toolRegistry.find(tool => tool.id === id); }
export function toolPath(tool: ToolDefinition): string { return `/tools/${tool.category}/${tool.id.slice(tool.category.length + 1)}`; }
export function toolFromPath(category: string, slug: string): ToolDefinition | undefined { return getTool(`${category}.${slug}`); }
export function searchTools(query: string, tools: readonly ToolDefinition[] = toolRegistry): ToolDefinition[] {
  const normalized = query.replace(/\s+/g, "").toLocaleLowerCase();
  const aliases:Record<string,string[]>={"pdf.convert":["pdf转word","pdf转图片","pdf转文字","pdf to word"],"image.resize":["改大小","修改尺寸","缩放"],"image.strip-metadata":["去隐私","删除位置"],"audio.trim":["剪音频","截取录音"],"pdf.ocr":["ocr","扫描件","文字识别"],"document.convert":["word转pdf","ppt转pdf","excel转pdf"]};
  if (!normalized) return [...tools];
  return tools.filter(tool => [tool.id, tool.name.zh, tool.name.en, tool.description.zh, tool.description.en, ...(tool.keywords ?? []),...(aliases[tool.id]??[])].some(value => value.replace(/\s+/g," ").replace(/\s/g,"").toLocaleLowerCase().includes(normalized)));
}
