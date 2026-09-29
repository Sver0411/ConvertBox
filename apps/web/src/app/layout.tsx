import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConvertBox — 本地图片转换",
  description: "在浏览器中转换 JPG、PNG 和 WebP 图片，文件不会上传。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
