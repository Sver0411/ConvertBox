"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, AudioLines, FileArchive, FileCheck2, FileText, Film, Image as ImageIcon, Search, Star, Table2 } from "lucide-react";
import { getServerCapabilities, type ServerCapabilities } from "@/lib/server-api";
import { toolAvailable } from "@/lib/tools/availability";
import { categoryNames, searchTools, toolCategories, toolPath, toolRegistry, type ToolCategory, type ToolDefinition } from "@/lib/tools/registry";
import { readToolPreferences, toggleFavorite, type ToolPreferences } from "@/lib/tools/preferences";
import type { Language } from "@/lib/messages";

const icons = { image: ImageIcon, pdf: FileText, document: FileText, data: Table2, audio: AudioLines, video: Film, archive: FileArchive, file: FileCheck2 };

function ToolCard({ tool, language, favorite, onFavorite }: { tool: ToolDefinition; language: Language; favorite: boolean; onFavorite: () => void }) {
  const Icon = icons[tool.category];
  return <div className="tool-card glass"><Link href={toolPath(tool)}><span className="tool-card-icon"><Icon size={22} strokeWidth={1.8} /></span><span className="tool-card-copy"><strong>{tool.name[language]}</strong><span>{tool.description[language]}</span></span><ArrowRight size={17} className="tool-card-arrow" /></Link><button type="button" className={`favorite-button ${favorite ? "is-favorite" : ""}`} onClick={onFavorite} aria-label={`${favorite ? "取消收藏" : "收藏"} ${tool.name.zh}`} title={favorite ? "取消收藏" : "收藏"}><Star size={18} fill={favorite ? "currentColor" : "none"} /></button></div>;
}

export default function ToolsHome() {
  const [language, setLanguage] = useState<Language>("zh");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "all">("all");
  const [prefs, setPrefs] = useState<ToolPreferences>({ version: 1, favorites: [], recent: [] });
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  useEffect(() => { setPrefs(readToolPreferences()); void getServerCapabilities().then(setCapabilities).catch(() => {}); }, []);
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);
  const available = useMemo(() => toolRegistry.filter(tool => toolAvailable(tool, capabilities)), [capabilities]);
  const tools = useMemo(() => searchTools(query, available).filter(tool => category === "all" || tool.category === category), [query, available, category]);
  const favorites = prefs.favorites.map(id => available.find(tool => tool.id === id)).filter((tool): tool is ToolDefinition => !!tool);
  const recent = prefs.recent.map(item => available.find(tool => tool.id === item.id)).filter((tool): tool is ToolDefinition => !!tool);
  const onFavorite = (id: string) => setPrefs(toggleFavorite(id));
  return <div className="tools-home-shell">
    <header className="tools-home-header glass"><Link href="/" className="header-context">{language === "zh" ? "文件工作台" : "File workbench"}</Link><div><Link href="/convert">{language === "zh" ? "转换" : "Convert"}</Link><Link href="/convert?tool=history">{language === "zh" ? "记录" : "History"}</Link><button className="language-switch" onClick={() => setLanguage(value => value === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button></div></header>
    <div className="tools-home-layout">
      <aside className="tools-home-sidebar glass"><strong>{language === "zh" ? "工具分类" : "Categories"}</strong><button className={category === "all" ? "selected" : ""} onClick={() => setCategory("all")}>{language === "zh" ? "全部工具" : "All tools"}</button>{toolCategories.filter(item => available.some(tool => tool.category === item)).map(item => { const Icon = icons[item]; return <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}><Icon size={17} />{categoryNames[item][language]}</button>; })}</aside>
      <main className="tools-home-main"><div className="tools-home-title"><h1>{language === "zh" ? "选择工具" : "Choose a tool"}</h1><p>{language === "zh" ? "搜索或按文件类型查找" : "Search or browse by file type"}</p></div><label className="tools-search"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={language === "zh" ? "搜索 PDF、图片、压缩…" : "Search PDF, image, compress…"} aria-label={language === "zh" ? "搜索工具" : "Search tools"} /><kbd>⌘ K</kbd></label>
        <div className="tools-home-sections">
          {!query && category === "all" && favorites.length > 0 && <section><h2>{language === "zh" ? "收藏" : "Favorites"}</h2><div className="tool-grid">{favorites.map(tool => <ToolCard key={tool.id} tool={tool} language={language} favorite onFavorite={() => onFavorite(tool.id)} />)}</div></section>}
          {!query && category === "all" && recent.length > 0 && <section><h2>{language === "zh" ? "最近使用" : "Recent"}</h2><div className="tool-grid">{recent.map(tool => <ToolCard key={tool.id} tool={tool} language={language} favorite={prefs.favorites.includes(tool.id)} onFavorite={() => onFavorite(tool.id)} />)}</div></section>}
          <section><h2>{query ? (language === "zh" ? "搜索结果" : "Results") : category === "all" ? (language === "zh" ? "全部工具" : "All tools") : categoryNames[category][language]}</h2>{tools.length ? <div className="tool-grid">{tools.map(tool => <ToolCard key={tool.id} tool={tool} language={language} favorite={prefs.favorites.includes(tool.id)} onFavorite={() => onFavorite(tool.id)} />)}</div> : <p className="tools-empty">{language === "zh" ? "没有找到可用工具" : "No available tools found"}</p>}</section>
        </div>
      </main>
    </div>
  </div>;
}
