"use client";

import { Clock3, FileImage, FileText, Film, Info, LayoutGrid, Music2, UploadCloud } from "lucide-react";
import type { ConversionJob } from "@shared/index";
import { copy, type Language } from "@/lib/messages";
import { conversionViews, viewAccepts, type ToolView } from "@/lib/workspace-views";

const icons = { all: LayoutGrid, image: FileImage, pdf: FileText, word: FileText, audio: Music2, video: Film, history: Clock3, about: Info };

type Theme = "light" | "dark" | "system";

export function WorkspaceShell({ children, jobs, activeView, language, theme, dragging, onView, onTheme, onLanguage, onDragEnter, onDragOver, onDragLeave, onDrop }: {
  children: React.ReactNode; jobs: ConversionJob[]; activeView: ToolView; language: Language; theme: Theme; dragging: boolean;
  onView: (view: ToolView) => void; onTheme: (theme: Theme) => void; onLanguage: () => void;
  onDragEnter: (event: React.DragEvent) => void; onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void; onDrop: (event: React.DragEvent) => void;
}) {
  const t = copy[language];
  return <div className="site-shell" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
    <header className="site-header glass"><span className="header-context">{language === "zh" ? "转换工作台" : "Conversion workspace"}</span><div className="header-end"><select className="theme-select" aria-label={t.theme} value={theme} onChange={event => onTheme(event.target.value as Theme)}><option value="light">{t.themeLight}</option><option value="dark">{t.themeDark}</option><option value="system">{t.themeSystem}</option></select><button className="language-switch" type="button" onClick={onLanguage} aria-label={language === "zh" ? "Switch to English" : "切换为中文"}>{language === "zh" ? "EN" : "中文"}</button></div></header>
    <div className="app-layout">
      <aside className="tool-sidebar glass" aria-label={language === "zh" ? "工具分类" : "Tool categories"}>
        <div className="sidebar-group">{conversionViews.map(item => { const Icon = icons[item]; const count = item === "all" ? jobs.length : jobs.filter(job => job.descriptor.category !== "unsupported" && viewAccepts(item, job.descriptor)).length; return <button key={item} className={`sidebar-item ${activeView === item ? "is-active" : ""}`} type="button" onClick={() => onView(item)} aria-current={activeView === item ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{t.views[item]}</span>{count > 0 && <small>{count}</small>}</button>; })}</div>
        <div className="sidebar-group sidebar-secondary">{(["history", "about"] as const).map(item => { const Icon = icons[item]; return <button key={item} className={`sidebar-item ${activeView === item ? "is-active" : ""}`} type="button" onClick={() => onView(item)} aria-current={activeView === item ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{t.views[item]}</span></button>; })}</div>
      </aside>
      <main id="top" className="app-main">{children}</main>
    </div>
    {dragging && <div className="drag-overlay" aria-hidden="true"><UploadCloud size={42} /><strong>{t.dropOverlay}</strong></div>}
  </div>;
}
