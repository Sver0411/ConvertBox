import type { Metadata } from "next";
import "./globals.css";
import ToolPalette from "@/components/tool-palette";

export const metadata: Metadata = {
  title: "ConvertBox — 文件工作台",
  description: "隐私友好的自托管文件工作台：转换、整理和检查常见文件。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}<ToolPalette /></body></html>;
}
