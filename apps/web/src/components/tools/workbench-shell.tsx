'use client';
import Link from 'next/link';
import {categoryNames,toolPath,toolRegistry,type ToolCategory} from '@/lib/tools/registry';
import type {Language} from '@/lib/messages';
export default function WorkbenchShell({children,language,theme,onLanguage,onTheme,category,active}:{children:React.ReactNode;language:Language;theme:string;onLanguage:()=>void;onTheme:(value:string)=>void;category?:ToolCategory;active?:string}){
 const t=(zh:string,en:string)=>language==='zh'?zh:en;
 return <div className="tools-home-shell"><header className="tools-home-header glass"><Link href="/">{t('文件工作台','File workbench')}</Link><div><Link href="/history">{t('记录','History')}</Link><Link href="/help">{t('说明','Help')}</Link><select aria-label={t('主题','Theme')} value={theme} onChange={event=>onTheme(event.target.value)}><option value="light">{t('浅色','Light')}</option><option value="dark">{t('深色','Dark')}</option></select><button className="language-switch" onClick={onLanguage}>{language==='zh'?'EN':'中文'}</button></div></header><div className="tools-home-layout workbench-layout"><aside className="tools-home-sidebar glass"><Link className="nav-home" href="/">← {t('工具中心','Tools')}</Link>{Object.entries(categoryNames).map(([key,name])=><details key={key} open={key===category}><summary>{name[language]}</summary>{toolRegistry.filter(tool=>tool.category===key).map(tool=><Link key={tool.id} className={tool.id===active?'selected':''} href={toolPath(tool)}>{tool.name[language]}</Link>)}</details>)}</aside>{children}</div></div>;
}
