"use client";

import type { HistoryEntry } from "@/lib/history";
import type { Language } from "@/lib/messages";

interface Props {
  entries: HistoryEntry[];
  language: Language;
  onClear: () => void;
  onReuse: (entry: HistoryEntry) => void;
}

export default function HistoryPanel({ entries, language, onClear, onReuse }: Props) {
  const zh = language === "zh";
  return <section id="history" className="history-section">
    <div className="history-heading"><h2>{zh ? "历史记录" : "History"}</h2>{entries.length > 0 && <button className="text-button" onClick={onClear}>{zh ? "清空记录" : "Clear history"}</button>}</div>
    <p className="history-note">{zh ? "仅在此浏览器保存转换记录，不保存文件。" : "Only conversion details are kept in this browser; files are not stored."}</p>
    {entries.length === 0 ? <p className="history-empty">{zh ? "暂无记录" : "No conversions yet"}</p> : <div className="history-list">{entries.slice(0, 20).map(entry => <div className="history-row" key={entry.id}><div><strong title={entry.name}>{entry.name}</strong><span>{entry.inputFormat.toUpperCase()} → {entry.outputFormat.toUpperCase()} · {new Date(entry.createdAt).toLocaleString(zh ? "zh-CN" : "en-US")}</span></div><button className="text-button" onClick={() => onReuse(entry)}>{zh ? "复用设置" : "Reuse settings"}</button></div>)}</div>}
  </section>;
}
