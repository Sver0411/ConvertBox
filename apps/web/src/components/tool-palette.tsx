"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getServerCapabilities, type ServerCapabilities } from "@/lib/server-api";
import { toolAvailable } from "@/lib/tools/availability";
import { searchTools, toolPath, toolRegistry } from "@/lib/tools/registry";

export default function ToolPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void getServerCapabilities().then(setCapabilities).catch(() => {}); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(value => !value); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) input.current?.focus(); else setQuery(""); }, [open]);
  const matches = useMemo(() => searchTools(query, toolRegistry.filter(tool => toolAvailable(tool, capabilities))).slice(0, 8), [query, capabilities]);
  if (!open) return null;
  return <div className="tool-palette-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <div className="tool-palette" role="dialog" aria-modal="true" aria-label="搜索工具">
      <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工具 / Search tools" aria-label="搜索工具" onKeyDown={event => { if (event.key === "Enter" && matches[0]) { router.push(toolPath(matches[0])); setOpen(false); } }} />
      <div className="tool-palette-results">{matches.map(tool => <button key={tool.id} type="button" onClick={() => { router.push(toolPath(tool)); setOpen(false); }}><strong>{tool.name.zh}</strong><span>{tool.name.en}</span></button>)}</div>
    </div>
  </div>;
}
