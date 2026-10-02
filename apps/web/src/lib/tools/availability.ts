import type { ServerCapabilities } from "@/lib/server-api";
import type { ToolDefinition } from "./registry";

export function toolAvailable(tool: ToolDefinition, capabilities: ServerCapabilities | null): boolean {
  if (tool.processing === "local" || tool.processing === "hybrid") return true;
  if (!capabilities) return false;
  if (!tool.workspace) return capabilities.tools?.[tool.id]?.available === true;
  if (tool.capability === "office") return capabilities.server.some(item => ["doc", "docx", "odt"].includes(item.input));
  if (tool.capability === "audio") return capabilities.server.some(item => item.input === "wav" && item.outputs.length > 0);
  if (tool.capability === "video") return capabilities.server.some(item => item.input === "mp4" && item.outputs.length > 0);
  if (tool.category === "pdf") return capabilities.server.some(item => item.input === "pdf") && (tool.operation === "convert" || capabilities.pdfOperations.includes(tool.operation));
  return true;
}
