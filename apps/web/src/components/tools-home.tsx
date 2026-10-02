"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowRight, AudioLines, FileArchive, FileCheck2, FileText, Film, Image as ImageIcon, Search, Star, Table2 } from "lucide-react";
import { getServerCapabilities, type ServerCapabilities } from "@/lib/server-api";
import { toolAvailable } from "@/lib/tools/availability";
import { categoryNames, searchTools, toolCategories, toolPath, toolRegistry, type ToolCategory, type ToolDefinition } from "@/lib/tools/registry";
import { readToolPreferences, toggleFavorite, type ToolPreferences } from "@/lib/tools/preferences";
import {useInterface} from "@/lib/use-interface";
import type { Language } from "@/lib/messages";

const icons = { image: ImageIcon, pdf: FileText, document: FileText, data: Table2, audio: AudioLines, video: Film, archive: FileArchive, file: FileCheck2 };

function ToolCard({ tool, language, favorite, onFavorite,unavailable=false }: { unavailable?:boolean; tool: ToolDefinition; language: Language; favorite: boolean; onFavorite: () => void }) {
  const Icon = icons[tool.category];
  return <div className="tool-card glass"><Link href={toolPath(tool)}><span className="tool-card-icon"><Icon size={22} strokeWidth={1.8} /></span><span className="tool-card-copy"><strong>{tool.name[language]}</strong><span>{unavailable?(language==='zh'?'当前服务未启用':'Unavailable on this server'):tool.description[language]}</span></span><ArrowRight size={17} className="tool-card-arrow" /></Link><button type="button" className={`favorite-button ${favorite ? "is-favorite" : ""}`} onClick={onFavorite} aria-label={`${language === "zh" ? favorite ? "取消收藏" : "收藏" : favorite ? "Unfavorite" : "Favorite"} ${tool.name[language]}`} title={language === "zh" ? favorite ? "取消收藏" : "收藏" : favorite ? "Unfavorite" : "Favorite"}><Star size={18} fill={favorite ? "currentColor" : "none"} /></button></div>;
}

export default function ToolsHome() {
  const {language,setLanguage,theme,setTheme}=useInterface();
  const [scope,setScope]=useState("all"),[serviceError,setServiceError]=useState(false),[ready,setReady]=useState(false);
  const scroller=useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "all">("all");
  const [prefs, setPrefs] = useState<ToolPreferences>({ version: 1, favorites: [], recent: [] });
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  useEffect(() => {setPrefs(readToolPreferences());try{const saved=JSON.parse(sessionStorage.getItem('convertbox-home')??'{}');setQuery(saved.query??'');setCategory(saved.category??'all');setScope(saved.scope??'all');requestAnimationFrame(()=>{if(scroller.current)scroller.current.scrollTop=saved.scroll??0;});}catch{}setReady(true);void getServerCapabilities().then(setCapabilities).catch(()=>setServiceError(true));},[]);
  useEffect(()=>{if(ready)sessionStorage.setItem('convertbox-home',JSON.stringify({query,category,scope,scroll:scroller.current?.scrollTop??0}));},[query,category,scope,ready]);
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);
  const available = useMemo(() => [...toolRegistry], []);
  const tools = useMemo(() => searchTools(query, available).filter(tool => (category === "all" || tool.category === category)&&(scope!=="favorites"||prefs.favorites.includes(tool.id))&&(scope!=="recent"||prefs.recent.some(item=>item.id===tool.id))), [query, available, category,scope,prefs]);
  const onFavorite = (id: string) => setPrefs(toggleFavorite(id));
  return <div className="tools-home-shell">
    <header className="tools-home-header glass"><Link href="/" className="header-context">{language === "zh" ? "文件工作台" : "File workbench"}</Link><div><select aria-label={language==="zh"?"主题":"Theme"} value={theme} onChange={event=>setTheme(event.target.value)}><option value="light">{language==="zh"?"浅色":"Light"}</option><option value="dark">{language==="zh"?"深色":"Dark"}</option></select><Link href="/help">{language === "zh" ? "说明" : "Help"}</Link><Link href="/history">{language === "zh" ? "记录" : "History"}</Link><button className="language-switch" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button></div></header>
    <div className="tools-home-layout">
      <aside className="tools-home-sidebar glass"><strong>{language === "zh" ? "工具分类" : "Categories"}</strong><button className={category === "all" ? "selected" : ""} onClick={() => setCategory("all")}>{language === "zh" ? "全部工具" : "All tools"}</button>{toolCategories.filter(item => available.some(tool => tool.category === item)).map(item => { const Icon = icons[item]; return <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}><Icon size={17} />{categoryNames[item][language]}</button>; })}</aside>
      <main className="tools-home-main"><div className="tools-home-title"><h1>{language === "zh" ? "选择工具" : "Choose a tool"}</h1><p>{language === "zh" ? "搜索或按文件类型查找" : "Search or browse by file type"}</p></div><label className="tools-search"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={language === "zh" ? "搜索 PDF、图片、压缩…" : "Search PDF, image, compress…"} aria-label={language === "zh" ? "搜索工具" : "Search tools"} /><kbd>⌘ K</kbd></label>
        <div className="home-filters">{[['all','全部','All'],['favorites','收藏','Favorites'],['recent','最近使用','Recent']].map(([value,zh,en])=><button key={value} className={scope===value?'selected':''} onClick={()=>setScope(value)}>{language==='zh'?zh:en}</button>)}</div>
        {serviceError&&<p role="status">{language==='zh'?'处理服务暂时离线，本地工具仍可使用。':'Processing service is offline. Local tools remain available.'}<button onClick={()=>{void getServerCapabilities().then(value=>{setCapabilities(value);setServiceError(false);}).catch(()=>setServiceError(true));}}>{language==='zh'?'重试连接':'Retry connection'}</button></p>}
        <div ref={scroller} className="tools-home-sections" onScroll={event=>{sessionStorage.setItem('convertbox-home',JSON.stringify({query,category,scope,scroll:event.currentTarget.scrollTop}));}}>
          <section><h2>{query ? (language === "zh" ? "搜索结果" : "Results") : category === "all" ? (language === "zh" ? "全部工具" : "All tools") : categoryNames[category][language]}</h2>{tools.length ? <div className="tool-grid">{tools.map(tool => <ToolCard key={tool.id} tool={tool} language={language} favorite={prefs.favorites.includes(tool.id)} onFavorite={() => onFavorite(tool.id)} unavailable={tool.processing==='server'&&!!capabilities&&!toolAvailable(tool,capabilities)} />)}</div> : <p className="tools-empty">{language === "zh" ? "没有找到可用工具" : "No available tools found"}</p>}</section>
        </div>
      </main>
    </div>
  </div>;
}
