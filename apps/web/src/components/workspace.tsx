"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUp, ArrowDown, Check, ChevronDown, CircleAlert, FileImage, FileText, Film, FolderPlus, LockKeyhole, Music2, RotateCcw, Trash2, UploadCloud, X, LayoutGrid, Clock3, Info } from "lucide-react";
import { IMAGE_FORMATS } from "@core/capabilities";
import { outputFilename } from "@core/filename";
import { detectFileType } from "@detection/detect";
import type { ConversionJob, ConversionSettings, FileDescriptor, ImageFormat } from "@shared/index";
import { browserCanEncode, convertImage, type ImageMetrics } from "@/lib/image-converter";
import { downloadBlob, downloadZip } from "@/lib/download";
import { copy, localizeError, type Language } from "@/lib/messages";
import { createServerJob, deleteServerJob, downloadServerJob, getServerCapabilities, pollServerJob, type ServerCapabilities } from "@/lib/server-api";
import HistoryPanel from "@/components/history-panel";
import { clearHistory, listHistory, saveHistory, type HistoryEntry } from "@/lib/history";
import { chinesePresetNames, defaultPresets, loadCustomPresets, storeCustomPresets, type Preset } from "@/lib/presets";
import { conversionViews, isConversionView, preferredOutput, toolViews, viewAccepts, viewInputAccept, viewOutputs, type ConversionView, type ToolView } from "@/lib/workspace-views";

const MAX_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const CONCURRENCY = 2;
const LOCAL_IMAGE_FORMATS = new Set(["jpg", "png", "webp"]);

function optionsFor(descriptor: FileDescriptor, browserFormats: ImageFormat[], server: ServerCapabilities | null): string[] {
  const local = descriptor.category === "image" && LOCAL_IMAGE_FORMATS.has(descriptor.detectedType) ? browserFormats : [];
  const remote = server?.server.find(item => item.input === descriptor.detectedType)?.outputs ?? [];
  return [...new Set([...local, ...remote])];
}

function optionsForMode(descriptor: FileDescriptor, browserFormats: ImageFormat[], server: ServerCapabilities | null, view: ConversionView): string[] {
  return viewOutputs(view, descriptor, optionsFor(descriptor, browserFormats, server));
}

function isLocal(input: string, output: string): boolean {
  return LOCAL_IMAGE_FORMATS.has(input) && LOCAL_IMAGE_FORMATS.has(output);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 ** 2 ? "KB" : "MB";
  return `${(bytes / (unit === "KB" ? 1024 : 1024 ** 2)).toFixed(1)} ${unit}`;
}

export default function Workspace() {
  const [language, setLanguage] = useState<Language>("zh");
  const t = copy[language];
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [activeView, setActiveView] = useState<ToolView>("all");
  const jobsRef = useRef<ConversionJob[]>([]);
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(85);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [keepMetadata, setKeepMetadata] = useState(false);
  const [pages, setPages] = useState("all");
  const [pageSize, setPageSize] = useState("auto");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("none");
  const [dpi, setDpi] = useState(144);
  const [rotation, setRotation] = useState(90);
  const [bitrate, setBitrate] = useState(192);
  const [sampleRate, setSampleRate] = useState(0);
  const [resolution, setResolution] = useState(0);
  const [fps, setFps] = useState(0);
  const [videoQuality, setVideoQuality] = useState("high");
  const [pdfOperation, setPdfOperation] = useState("convert");
  const [serverCapabilities, setServerCapabilities] = useState<ServerCapabilities | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [presetChoice, setPresetChoice] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<{ name: string; metrics: ImageMetrics } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [availableFormats, setAvailableFormats] = useState<ImageFormat[]>(["jpg", "png"]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "limit" | "partial" | "zip" | "server"; count?: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const dragDepth = useRef(0);

  const updateJobs = useCallback((fn: (current: ConversionJob[]) => ConversionJob[]) => {
    jobsRef.current = fn(jobsRef.current);
    setJobs([...jobsRef.current]);
  }, []);

  useEffect(() => {
    const supported = IMAGE_FORMATS.filter(browserCanEncode);
    setAvailableFormats(supported);
    if (!supported.includes("webp")) setFormat(supported.includes("png") ? "png" : "jpg");
    const activeControllers = controllers.current;
    return () => activeControllers.forEach(controller => controller.abort());
  }, []);

  useEffect(() => {
    let active = true;
    getServerCapabilities().then(result => { if (active) setServerCapabilities(result); }).catch(() => { if (active) setServerCapabilities(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);

  useEffect(() => { void listHistory().then(setHistory).catch(() => {}); }, []);
  useEffect(() => { setCustomPresets(loadCustomPresets()); }, []);
  useEffect(() => { setShowDebug(process.env.NODE_ENV === "development" && new URLSearchParams(location.search).has("debug")); }, []);
  useEffect(() => {
    const readView = () => {
      const value = new URLSearchParams(location.search).get("tool");
      setActiveView(toolViews.find(item => item === value) ?? "all");
    };
    readView();
    window.addEventListener("popstate", readView);
    return () => window.removeEventListener("popstate", readView);
  }, []);

  const selectView = useCallback((view: ToolView) => {
    if (view === activeView) return;
    setActiveView(view);
    setNotice(null);
    setPresetChoice("");
    if (isConversionView(view)) {
      const first = jobsRef.current.find(job => job.descriptor.category !== "unsupported" && viewAccepts(view, job.descriptor));
      const firstOptions = first ? optionsForMode(first.descriptor, availableFormats, serverCapabilities, view) : [];
      setFormat(first ? preferredOutput(view, first.descriptor, firstOptions, first.settings.output) : ({ all: "webp", image: "jpg", pdf: "png", word: "pdf", audio: "mp3", video: "mp4" } as Record<ConversionView, string>)[view]);
      if (view !== "all") updateJobs(current => current.map(job => {
        if (job.descriptor.category === "unsupported" || !viewAccepts(view, job.descriptor) || !["CREATED", "FAILED", "CANCELLED"].includes(job.status)) return job;
        const options = optionsForMode(job.descriptor, availableFormats, serverCapabilities, view);
        const output = preferredOutput(view, job.descriptor, options, job.settings.output);
        return output && output !== job.settings.output ? { ...job, settings: { ...job.settings, output } } : job;
      }));
    }
    const url = new URL(location.href);
    if (view === "all") url.searchParams.delete("tool");
    else url.searchParams.set("tool", view);
    window.history.pushState(null, "", url);
  }, [activeView, availableFormats, serverCapabilities, updateJobs]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? media.matches ? "dark" : "light" : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const recordHistory = useCallback((job: ConversionJob, outputFormat: string, outputSize: number, settings: Record<string, string | number | boolean>) => {
    const entry: HistoryEntry = { id: crypto.randomUUID(), name: job.file.name, inputFormat: job.descriptor.detectedType,
      outputFormat, inputSize: job.file.size, outputSize, createdAt: Date.now(), settings };
    void saveHistory(entry).then(() => listHistory().then(setHistory)).catch(() => {});
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    setNotice(null);
    const view = isConversionView(activeView) ? activeView : "all";
    const remaining = MAX_FILES - jobsRef.current.length;
    if (remaining <= 0) { setNotice({ type: "limit" }); return; }
    if (files.length > remaining) setNotice({ type: "partial", count: remaining });
    const activeServer = serverCapabilities ?? await getServerCapabilities().then(result => { setServerCapabilities(result); return result; }).catch(() => null);
    const additions = await Promise.all(files.slice(0, remaining).map(async file => {
      const descriptor = await detectFileType(file);
      const options = optionsForMode(descriptor, availableFormats, activeServer, view);
      const selected = preferredOutput(view, descriptor, options, format);
      const limit = isLocal(descriptor.detectedType, selected) && file.size <= MAX_INPUT_SIZE ? MAX_INPUT_SIZE : activeServer?.maxUploadSize ?? 0;
      if (!descriptor.error && !viewAccepts(view, descriptor)) descriptor.error = "File is not suitable for this workspace.";
      if (file.size > limit) descriptor.error = "File exceeds the available processing limit.";
      if (!descriptor.error && options.length === 0) descriptor.error = "Server converter is unavailable for this file.";
      if (descriptor.error) descriptor.category = "unsupported";
      return {
        id: crypto.randomUUID(), workspace: view, file, descriptor, settings: { output: selected, quality },
        status: descriptor.error ? "FAILED" : "CREATED", stage: "queued", createdAt: Date.now(),
        error: descriptor.error,
      } satisfies ConversionJob;
    }));
    if (additions[0]?.settings.output) setFormat(additions[0].settings.output);
    updateJobs(current => [...current, ...additions]);
  }, [activeView, format, quality, availableFormats, serverCapabilities, updateJobs]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!isConversionView(activeView)) {
      setActiveView("all");
      const url = new URL(location.href);
      url.searchParams.delete("tool");
      window.history.pushState(null, "", url);
    }
    void addFiles(Array.from(event.dataTransfer.files));
  }, [activeView, addFiles]);

  const patchJob = useCallback((id: string, patch: Partial<ConversionJob>) => {
    updateJobs(current => current.map(job => job.id === id ? { ...job, ...patch } : job));
  }, [updateJobs]);

  const runBatch = useCallback(async () => {
    if (busy || !isConversionView(activeView)) return;
    const view = isConversionView(activeView) ? activeView : "all";
    const pending = jobsRef.current.filter(job => job.descriptor.category !== "unsupported" && viewAccepts(view, job.descriptor) && ["CREATED", "FAILED", "CANCELLED"].includes(job.status));
    if (!pending.length) return;
    setBusy(true);
    updateJobs(current => current.map(job => pending.some(item => item.id === job.id)
      ? { ...job, status: "QUEUED", stage: "queued", error: undefined, output: undefined, serverId: undefined, progress: null }
      : job));
    let cursor = 0;
    const runOne = async () => {
      while (cursor < pending.length) {
        const job = pending[cursor++];
        if (jobsRef.current.find(item => item.id === job.id)?.status === "CANCELLED") continue;
        const controller = new AbortController();
        controllers.current.set(job.id, controller);
        if (controller.signal.aborted) continue;
        const settings = { ...job.settings, quality, width, height, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality };
        const local = isLocal(job.descriptor.detectedType, settings.output) && job.file.size <= MAX_INPUT_SIZE && !keepMetadata;
        patchJob(job.id, { status: "PROCESSING", stage: local ? "decoding" : "uploading", settings, startedAt: Date.now() });
        try {
          if (local) {
            const localSettings: ConversionSettings = { output: settings.output as ImageFormat, quality, width, height };
            if (job.file.size > MAX_INPUT_SIZE) throw new Error("File exceeds the 25 MB local limit.");
            const blob = await convertImage(job.file, localSettings, stage => patchJob(job.id, { stage }), controller.signal, metrics => setDebugMetrics({ name: job.file.name, metrics }));
            patchJob(job.id, { status: "COMPLETED", stage: "completed", output: blob, outputSize: blob.size,
              outputName: outputFilename(job.file.name, localSettings.output), completedAt: Date.now() });
            recordHistory(job, localSettings.output, blob.size, { quality, width, height });
          } else {
            const operation = job.descriptor.category === "pdf" && activeView !== "word" ? pdfOperation : "convert";
            const created = await createServerJob([job.file], settings.output, operation, { quality, width, height, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality, page_size: pageSize, orientation, margin, keep_metadata: keepMetadata }, controller.signal);
            patchJob(job.id, { serverId: created.id, status: "QUEUED", stage: "queued" });
            const finished = await pollServerJob(created.id, state => patchJob(job.id, {
              status: state.status === "QUEUED" ? "QUEUED" : state.status === "PROCESSING" ? "PROCESSING" : state.status === "FAILED" ? "FAILED" : state.status === "COMPLETED" ? "COMPLETED" : "CANCELLED",
              stage: state.status === "COMPLETED" ? "completed" : "processing", progress: state.progress,
              error: state.error ?? undefined, outputName: state.outputName ?? undefined, outputSize: state.outputSize ?? undefined,
            }), controller.signal);
            if (finished.status !== "COMPLETED") throw new Error(finished.error ?? "Server conversion failed");
            patchJob(job.id, { status: "COMPLETED", completedAt: Date.now() });
            recordHistory(job, settings.output, finished.outputSize ?? 0, { quality, width, height, keep_metadata: keepMetadata, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality });
          }
        } catch (error) {
          const cancelled = error instanceof DOMException && error.name === "AbortError";
          patchJob(job.id, { status: cancelled ? "CANCELLED" : "FAILED", error: cancelled ? undefined : error instanceof Error ? error.message : "Conversion failed." });
        } finally {
          controllers.current.delete(job.id);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, runOne));
    setBusy(false);
  }, [activeView, busy, quality, width, height, keepMetadata, pages, dpi, rotation, bitrate, sampleRate, resolution, fps, videoQuality, pageSize, orientation, margin, pdfOperation, patchJob, updateJobs, recordHistory]);

  const runGroup = useCallback(async (kind: "merge" | "images") => {
    if (busy) return;
    const view = isConversionView(activeView) ? activeView : "all";
    const sources = jobsRef.current.filter(job => job.file.size > 0 && viewAccepts(view, job.descriptor) && job.descriptor.category === (kind === "merge" ? "pdf" : "image"));
    if (sources.length < 2) return;
    const first = sources[0];
    const label = kind === "merge" ? "merged.pdf" : "images.pdf";
    const id = crypto.randomUUID();
    const result: ConversionJob = {
      id, workspace: view, file: new File([], label), descriptor: { ...first.descriptor, name: label, detectedType: "pdf", category: "pdf", size: 0 },
      settings: { output: "pdf", quality }, status: "PROCESSING", stage: "uploading", createdAt: Date.now(),
    };
    setBusy(true);
    updateJobs(current => [...current, result]);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    try {
      const created = await createServerJob(sources.map(job => job.file), "pdf", kind === "merge" ? "merge" : "convert", { quality, page_size: pageSize, orientation, margin }, controller.signal);
      patchJob(id, { serverId: created.id, status: "QUEUED", stage: "queued" });
      const finished = await pollServerJob(created.id, state => patchJob(id, {
        status: state.status === "COMPLETED" ? "COMPLETED" : state.status === "FAILED" ? "FAILED" : state.status === "PROCESSING" ? "PROCESSING" : "QUEUED",
        stage: state.status === "COMPLETED" ? "completed" : "processing", progress: state.progress,
        error: state.error ?? undefined, outputName: state.outputName ?? undefined, outputSize: state.outputSize ?? undefined,
      }), controller.signal);
      if (finished.status !== "COMPLETED") throw new Error(finished.error ?? "Server conversion failed");
      patchJob(id, { status: "COMPLETED", completedAt: Date.now() });
      recordHistory(result, "pdf", finished.outputSize ?? 0, { quality });
    } catch (error) {
      patchJob(id, { status: "FAILED", error: error instanceof Error ? error.message : "Server conversion failed" });
    } finally {
      controllers.current.delete(id);
      setBusy(false);
    }
  }, [activeView, busy, quality, pageSize, orientation, margin, patchJob, updateJobs, recordHistory]);

  const cancelJob = (id: string) => {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    const job = jobsRef.current.find(item => item.id === id);
    if (job?.serverId && job.status === "QUEUED") void deleteServerJob(job.serverId).catch(() => {});
    if (!controller) patchJob(id, { status: "CANCELLED" });
  };

  const removeJob = (id: string) => {
    controllers.current.get(id)?.abort();
    const job = jobsRef.current.find(item => item.id === id);
    if (job?.serverId && job.status !== "PROCESSING") void deleteServerJob(job.serverId).catch(() => {});
    updateJobs(current => current.filter(job => job.id !== id));
  };

  const applyPreset = (preset: Preset) => {
    if (busy) return;
    setFormat(preset.output);
    setQuality(preset.quality);
    setWidth(preset.width);
    setHeight(preset.height);
    setBitrate(preset.bitrate);
    setResolution(preset.resolution);
    setVideoQuality(preset.videoQuality);
    setKeepMetadata(preset.keepMetadata);
    const view = isConversionView(activeView) ? activeView : "all";
    updateJobs(current => current.map(job => viewAccepts(view, job.descriptor) && optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(preset.output)
      ? { ...job, settings: { ...job.settings, output: preset.output } } : job));
  };

  const savePreset = () => {
    const name = newPresetName.trim().slice(0, 50);
    if (!name || !oneCategory || !["image", "audio", "video"].includes(oneCategory) || customPresets.length >= 20) return;
    const preset: Preset = { id: crypto.randomUUID(), name, category: oneCategory as Preset["category"], output: format,
      quality, width, height, bitrate, resolution, videoQuality, keepMetadata, custom: true };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    storeCustomPresets(next);
    setNewPresetName("");
    setSavingPreset(false);
  };

  const deletePreset = () => {
    const next = customPresets.filter(item => item.id !== presetChoice);
    setCustomPresets(next);
    storeCustomPresets(next);
    setPresetChoice("");
  };

  const moveJob = (id: string, direction: -1 | 1) => {
    updateJobs(current => {
      const next = [...current];
      const index = next.findIndex(job => job.id === id);
      const view = isConversionView(activeView) ? activeView : "all";
      let target = index + direction;
      while (target >= 0 && target < next.length && !viewAccepts(view, next[target].descriptor)) target += direction;
      if (index >= 0 && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!isConversionView(activeView)) selectView("all");
        fileInput.current?.click();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault(); void runBatch();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeView, runBatch, selectView]);

  const view = isConversionView(activeView) ? activeView : "all";
  const visibleJobs = jobs.filter(job => {
    if (view === "all") return true;
    if (job.file.size === 0 || job.descriptor.category === "unsupported") return job.workspace === view;
    return viewAccepts(view, job.descriptor);
  });
  const supported = visibleJobs.filter(job => job.descriptor.category !== "unsupported");
  const completed = supported.filter(job => job.status === "COMPLETED");
  const failed = visibleJobs.filter(job => job.status === "FAILED");
  const settled = supported.filter(job => ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)).length;
  const zipBytes = completed.reduce((sum, job) => sum + (job.output?.size ?? 0), 0);
  const canZip = completed.length > 1 && completed.every(job => job.output) && zipBytes <= MAX_ZIP_BYTES;
  const pendingCount = supported.filter(job => ["CREATED", "FAILED", "CANCELLED"].includes(job.status)).length;
  const noticeText = notice?.type === "limit" ? t.limit : notice?.type === "partial" ? t.partial(notice.count ?? 0) : notice?.type === "zip" ? t.zipError : notice?.type === "server" ? t.serverUnavailable : "";
  const categories = new Set(supported.map(job => job.descriptor.category));
  const oneCategory = categories.size === 1 ? supported[0]?.descriptor.category : null;
  const bulkOptions = supported.length ? optionsForMode(supported[0].descriptor, availableFormats, serverCapabilities, view).filter(option => supported.every(job => optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(option))) : availableFormats;
  const shownOptions = oneCategory === "pdf" && view !== "word" && pdfOperation !== "convert" ? ["pdf"] : bulkOptions;
  const allLocal = supported.length > 0 && supported.every(job => isLocal(job.descriptor.detectedType, job.settings.output) && job.file.size <= MAX_INPUT_SIZE && !keepMetadata);
  const groupKind = oneCategory === "pdf" && view !== "word" && pdfOperation === "merge" && supported.filter(job => job.file.size > 0).length >= 2 ? "merge" : oneCategory === "image" && format === "pdf" && supported.filter(job => job.file.size > 0).length >= 2 ? "images" : null;
  const icons = { all: LayoutGrid, image: FileImage, pdf: FileText, word: FileText, audio: Music2, video: Film, history: Clock3, about: Info };

  return <div className="site-shell" onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }} onDragOver={event => event.preventDefault()} onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={onDrop}>
    <header className="site-header glass">
      <span className="header-context">{language === "zh" ? "转换工作台" : "Conversion workspace"}</span>
      <div className="header-end"><select className="theme-select" aria-label={t.theme} value={theme} onChange={event => setTheme(event.target.value as "light" | "dark" | "system")}><option value="light">{t.themeLight}</option><option value="dark">{t.themeDark}</option><option value="system">{t.themeSystem}</option></select><button className="language-switch" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? "Switch to English" : "切换为中文"}>{language === "zh" ? "EN" : "中文"}</button></div>
    </header>

    <div className="app-layout">
      <aside className="tool-sidebar glass" aria-label={language === "zh" ? "工具分类" : "Tool categories"}>
        <div className="sidebar-group">{conversionViews.map(item => { const Icon = icons[item]; const count = item === "all" ? jobs.length : jobs.filter(job => job.descriptor.category !== "unsupported" && viewAccepts(item, job.descriptor)).length; return <button key={item} className={`sidebar-item ${activeView === item ? "is-active" : ""}`} type="button" onClick={() => selectView(item)} aria-current={activeView === item ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{t.views[item]}</span>{count > 0 && <small>{count}</small>}</button>; })}</div>
        <div className="sidebar-group sidebar-secondary">{(["history", "about"] as const).map(item => { const Icon = icons[item]; return <button key={item} className={`sidebar-item ${activeView === item ? "is-active" : ""}`} type="button" onClick={() => selectView(item)} aria-current={activeView === item ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{t.views[item]}</span></button>; })}</div>
      </aside>
      <main id="top" className="app-main">
      <input ref={fileInput} type="file" multiple hidden accept={isConversionView(activeView) ? viewInputAccept[activeView] : ""} onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} aria-label={t.chooseFiles} />
      {isConversionView(activeView) && <>
      <section className={`hero ${visibleJobs.length ? "hero-compact" : ""}`} id="convert">
        <h1>{t.viewTitles[activeView]}</h1>
        <p className="hero-copy">{t.viewHelp[activeView]}</p>
      </section>

      {!visibleJobs.length ? <section className={`drop-zone glass ${dragging ? "is-dragging" : ""}`}>
        <div className="drop-icon"><UploadCloud size={28} strokeWidth={1.6} /></div>
        <h2>{t.dropTitle}</h2>
        <p>{t.dropSub}</p>
        <button className="primary-button" onClick={() => fileInput.current?.click()}><FolderPlus size={18} /> {t.chooseFiles} <ArrowRight size={17} /></button>
      </section> : <section className="workspace glass" aria-label={t.workspace}>
        <div className="workspace-top"><div><h2>{t.yourFiles} <span className="count-badge">{visibleJobs.length}</span></h2><p>{pendingCount ? t.readyCount(pendingCount) : t.completeCount(completed.length)}{visibleJobs.length - supported.length ? ` · ${t.unsupportedCount(visibleJobs.length - supported.length)}` : ""}</p></div><button className="secondary-button" onClick={() => fileInput.current?.click()}><FolderPlus size={17} /> {t.addFiles}</button></div>
        <div className="settings-panel">
          {(oneCategory === "image" || oneCategory === "audio" || oneCategory === "video") && <div className="preset-field"><label htmlFor="preset">{t.preset}</label><div className="preset-controls"><select id="preset" value={presetChoice} onChange={event => { setPresetChoice(event.target.value); const preset = [...defaultPresets, ...customPresets].find(item => item.id === event.target.value); if (preset) applyPreset(preset); }} disabled={busy}><option value="">{t.choosePreset}</option>{[...defaultPresets, ...customPresets].filter(item => item.category === oneCategory && supported.every(job => optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(item.output))).map(item => <option key={item.id} value={item.id}>{language === "zh" ? chinesePresetNames[item.id] ?? item.name : item.name}</option>)}</select><button className="text-button" onClick={() => setSavingPreset(value => !value)} disabled={busy}>{t.savePreset}</button>{customPresets.some(item => item.id === presetChoice) && <button className="text-button" onClick={deletePreset} disabled={busy}>{t.deletePreset}</button>}</div>{savingPreset && <div className="preset-controls"><input value={newPresetName} maxLength={50} placeholder={t.presetName} onChange={event => setNewPresetName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") savePreset(); if (event.key === "Escape") setSavingPreset(false); }} /><button className="text-button" onClick={savePreset} disabled={!newPresetName.trim()}>{t.save}</button></div>}</div>}
          {shownOptions.length > 0 && <div className="setting-field"><label htmlFor="format">{t.convertTo}</label><div className="select-wrap"><select id="format" value={shownOptions.includes(format) ? format : shownOptions[0]} onChange={event => { const selected = event.target.value; setFormat(selected); updateJobs(current => current.map(job => job.descriptor.category !== "unsupported" && viewAccepts(view, job.descriptor) && optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(selected) ? { ...job, settings: { ...job.settings, output: selected } } : job)); }} disabled={busy}>{shownOptions.map(item => <option key={item} value={item}>{item.toUpperCase()}{oneCategory === "pdf" && item === "docx" ? t.textOnly : ""}</option>)}</select><ChevronDown size={16} /></div></div>}
          {(oneCategory === "image" || (oneCategory === "pdf" && format === "jpg")) && <div className="setting-field quality-field"><label htmlFor="quality">{t.quality} <span>{quality}%</span></label><input id="quality" type="range" min="1" max="100" value={quality} onChange={event => setQuality(Number(event.target.value))} disabled={busy || format === "png" || format === "pdf"} /><small>{format === "png" || format === "pdf" ? t.pngQuality : t.otherQuality}</small></div>}
          <div className="setting-note"><LockKeyhole size={17} /><span><strong>{allLocal ? t.localTitle : t.serverTitle}</strong><br />{allLocal ? t.localDetail : t.serverDetail}</span></div>
          {oneCategory === "image" && format !== "pdf" && <div className="settings-extra"><div className="setting-field"><label htmlFor="width">{t.width}</label><input id="width" type="number" min="0" max="12000" value={width || ""} placeholder={t.original} onChange={event => setWidth(Number(event.target.value) || 0)} disabled={busy} /></div><div className="setting-field"><label htmlFor="height">{t.height}</label><input id="height" type="number" min="0" max="12000" value={height || ""} placeholder={t.original} onChange={event => setHeight(Number(event.target.value) || 0)} disabled={busy} /></div><small>{t.resizeHint}</small></div>}
          {oneCategory === "image" && format !== "pdf" && <div className="settings-extra"><div className="setting-field"><label htmlFor="metadata">{t.metadata}</label><select id="metadata" value={keepMetadata ? "keep" : "remove"} onChange={event => setKeepMetadata(event.target.value === "keep")} disabled={busy || !serverCapabilities}><option value="remove">{t.removeMetadata}</option>{serverCapabilities && <option value="keep">{t.keepMetadata}</option>}</select></div></div>}
          {oneCategory === "pdf" && view !== "word" && <div className="settings-extra"><div className="setting-field"><label htmlFor="pdf-operation">{t.pdfAction}</label><select id="pdf-operation" value={pdfOperation} onChange={event => { const next = event.target.value; setPdfOperation(next); if (next !== "convert") { setFormat("pdf"); updateJobs(current => current.map(job => job.descriptor.category === "pdf" ? { ...job, settings: { ...job.settings, output: "pdf" } } : job)); } else { setFormat("png"); updateJobs(current => current.map(job => job.descriptor.category === "pdf" ? { ...job, settings: { ...job.settings, output: "png" } } : job)); } }} disabled={busy}><option value="convert">{t.pdfConvert}</option><option value="split">{t.pdfSplit}</option><option value="rotate">{t.pdfRotate}</option><option value="compress">{t.pdfCompress}</option>{supported.length > 1 && <option value="merge">{t.pdfMerge}</option>}</select></div>{pdfOperation !== "merge" && <div className="setting-field"><label htmlFor="pages">{t.pages}</label><input id="pages" value={pages} onChange={event => setPages(event.target.value)} placeholder={pdfOperation === "split" ? "all / 1-3;4-6" : "all / 1-3,5"} disabled={busy} /></div>}{pdfOperation === "convert" && (format === "png" || format === "jpg") && <div className="setting-field"><label htmlFor="dpi">DPI</label><select id="dpi" value={dpi} onChange={event => setDpi(Number(event.target.value))} disabled={busy}>{[72, 144, 216, 300].map(value => <option key={value}>{value}</option>)}</select></div>}{pdfOperation === "rotate" && <div className="setting-field"><label htmlFor="rotation">{t.rotation}</label><select id="rotation" value={rotation} onChange={event => setRotation(Number(event.target.value))} disabled={busy}>{[90, 180, 270].map(value => <option key={value}>{value}°</option>)}</select></div>}</div>}
          {(oneCategory === "audio" || oneCategory === "video") && <div className="settings-extra"><div className="setting-field"><label htmlFor="bitrate">{t.audioBitrate}</label><select id="bitrate" value={bitrate} onChange={event => setBitrate(Number(event.target.value))} disabled={busy}>{[96,128,192,256,320].map(value => <option key={value} value={value}>{value} kbps</option>)}</select></div>{oneCategory === "audio" && <div className="setting-field"><label htmlFor="sample-rate">{t.sampleRate}</label><select id="sample-rate" value={sampleRate} onChange={event => setSampleRate(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option><option value="44100">44100 Hz</option><option value="48000">48000 Hz</option></select></div>}{oneCategory === "video" && <><div className="setting-field"><label htmlFor="resolution">{t.resolution}</label><select id="resolution" value={resolution} onChange={event => setResolution(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option>{[2160,1440,1080,720,480].map(value => <option key={value} value={value}>{value}p</option>)}</select></div><div className="setting-field"><label htmlFor="fps">FPS</label><select id="fps" value={fps} onChange={event => setFps(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option>{[60,30,24].map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="setting-field"><label htmlFor="video-quality">{t.quality}</label><select id="video-quality" value={videoQuality} onChange={event => setVideoQuality(event.target.value)} disabled={busy}><option value="very_high">{t.veryHigh}</option><option value="high">{t.high}</option><option value="medium">{t.medium}</option><option value="low">{t.low}</option></select></div></>}</div>}
          {oneCategory === "image" && format === "pdf" && <div className="settings-extra"><div className="setting-field"><label htmlFor="page-size">{t.pageSize}</label><select id="page-size" value={pageSize} onChange={event => setPageSize(event.target.value)} disabled={busy}><option value="auto">{t.auto}</option><option value="a4">A4</option><option value="letter">Letter</option></select></div><div className="setting-field"><label htmlFor="orientation">{t.orientation}</label><select id="orientation" value={orientation} onChange={event => setOrientation(event.target.value)} disabled={busy}><option value="auto">{t.auto}</option><option value="portrait">{t.portrait}</option><option value="landscape">{t.landscape}</option></select></div><div className="setting-field"><label htmlFor="margin">{t.margin}</label><select id="margin" value={margin} onChange={event => setMargin(event.target.value)} disabled={busy}><option value="none">{t.none}</option><option value="small">{t.small}</option><option value="medium">{t.medium}</option><option value="large">{t.large}</option></select></div></div>}
        </div>
        {noticeText && <p className="notice" role="status"><CircleAlert size={16} />{noticeText}</p>}
        <div className="file-list" role="list">{visibleJobs.map(job => <div className="file-row" role="listitem" key={job.id}>
          <div className={`file-icon ${job.status === "FAILED" ? "file-icon-error" : ""}`}>{job.descriptor.category === "video" ? <Film size={21} /> : job.descriptor.category === "audio" ? <Music2 size={21} /> : job.descriptor.category === "office" || job.descriptor.category === "pdf" ? <FileText size={21} /> : <FileImage size={21} strokeWidth={1.7} />}</div>
          <div className="file-main"><div className="file-name" title={job.file.name}>{job.file.name}</div><div className="file-sub">{job.file.size ? humanSize(job.file.size) : t.groupResult} <span>·</span> {job.descriptor.detectedType.toUpperCase()} <span>·</span> {(job.output || !job.serverId && isLocal(job.descriptor.detectedType, job.settings.output) && job.file.size <= MAX_INPUT_SIZE && !keepMetadata) ? t.localShort : t.serverShort}{job.status === "COMPLETED" && job.outputName ? <> <span>→</span> {job.outputName.split(".").pop()?.toUpperCase()} <span>·</span> {humanSize(job.outputSize ?? job.output?.size ?? 0)}{job.file.size > 0 ? <> <span>·</span> {t.sizeChange(Math.round((1 - (job.outputSize ?? job.output?.size ?? 0) / job.file.size) * 100))}</> : null}</> : null}</div>{job.error && <div className="file-error">{localizeError(job.error, language)}</div>}</div>
          {job.descriptor.category !== "unsupported" && job.status !== "COMPLETED" && shownOptions.length === 0 && (pdfOperation === "convert" || view === "word") && <select className="row-target" aria-label={`${job.file.name} ${t.convertTo}`} value={job.settings.output} onChange={event => patchJob(job.id, { settings: { ...job.settings, output: event.target.value } })} disabled={busy}>{optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select>}
          <div className={`status-pill status-${job.status.toLowerCase()}`}>{job.status === "COMPLETED" && <Check size={13} />}{job.status === "FAILED" && <CircleAlert size={13} />}{job.status === "PROCESSING" ? job.stage === "uploading" ? t.uploading : job.progress != null ? `${Math.round(job.progress * 100)}%` : job.stage === "encoding" ? t.encoding : job.stage === "decoding" ? t.decoding : t.processing : t.status[job.status]}</div>
          <div className="row-actions">{groupKind && job.file.size > 0 && <><button className="icon-button" title={t.moveUp} aria-label={`${t.moveUp} ${job.file.name}`} onClick={() => moveJob(job.id, -1)} disabled={busy || visibleJobs[0]?.id === job.id}><ArrowUp size={15} /></button><button className="icon-button" title={t.moveDown} aria-label={`${t.moveDown} ${job.file.name}`} onClick={() => moveJob(job.id, 1)} disabled={busy || visibleJobs[visibleJobs.length - 1]?.id === job.id}><ArrowDown size={15} /></button></>}{job.status === "COMPLETED" && job.outputName && <button className="icon-button" title={t.download} aria-label={`${t.download} ${job.outputName}`} onClick={() => job.serverId ? downloadServerJob(job.serverId) : job.output && downloadBlob(job.output, job.outputName!)}><ArrowDownToLine size={18} /></button>}{(job.status === "QUEUED" || (job.status === "PROCESSING" && (job.stage === "uploading" || isLocal(job.descriptor.detectedType, job.settings.output)))) && <button className="icon-button" title={t.cancel} aria-label={`${t.cancel} ${job.file.name}`} onClick={() => cancelJob(job.id)}><X size={18} /></button>}{(job.status === "FAILED" || job.status === "CANCELLED") && job.descriptor.category !== "unsupported" && <button className="icon-button" title={t.retry} aria-label={`${t.retry} ${job.file.name}`} onClick={() => { patchJob(job.id, { status: "CREATED", error: undefined }); }}><RotateCcw size={17} /></button>}{!(job.serverId && job.status === "PROCESSING") && <button className="icon-button muted-action" title={t.remove} aria-label={`${t.remove} ${job.file.name}`} onClick={() => removeJob(job.id)}><Trash2 size={17} /></button>}</div>
        </div>)}</div>
        <div className="workspace-footer"><div className="progress-side">{busy ? <><div className="progress-label"><span>{t.convertProgress}</span><strong>{settled} / {supported.length}</strong></div><div className="progress-track" role="progressbar" aria-valuenow={settled} aria-valuemin={0} aria-valuemax={supported.length}><div style={{ width: `${supported.length ? (settled / supported.length) * 100 : 0}%` }} /></div></> : completed.length ? <div className="summary"><Check size={16} /> {t.completeSummary(completed.length)}{failed.filter(job => job.descriptor.category !== "unsupported").length ? ` · ${t.failedSummary(failed.filter(job => job.descriptor.category !== "unsupported").length)}` : ""}</div> : <div className="summary-sub">{supported.length ? t.ready : t.addSupported}</div>}</div><div className="footer-actions">{canZip && <button className="secondary-button" onClick={() => { void downloadZip(completed.filter(job => job.output && job.outputName).map(job => ({ name: job.outputName!, blob: job.output! }))).catch(() => setNotice({ type: "zip" })); }}><ArrowDownToLine size={17} /> {t.downloadAll}</button>}{completed.length > 1 && completed.every(job => job.output) && !canZip && <span className="zip-note">{t.zipLimit}</span>}{groupKind ? <button className="primary-button" disabled={busy} onClick={() => void runGroup(groupKind)}>{groupKind === "merge" ? t.pdfMerge : t.imagesToPdf}<ArrowRight size={17} /></button> : (pendingCount > 0 || busy) && <button className="primary-button" disabled={busy || !pendingCount} onClick={() => void runBatch()}>{busy ? t.converting : completed.length ? t.convertRemaining : t.convertFiles}<ArrowRight size={17} /></button>}</div></div>
      </section>}
      {showDebug && <section className="debug-metrics"><h2>Debug metrics</h2>{debugMetrics ? <pre>{JSON.stringify({ file: debugMetrics.name, ...debugMetrics.metrics, peakMemory: "unavailable" }, null, 2)}</pre> : <p>Run a local image conversion to collect timing data.</p>}</section>}
      </>}
      {activeView === "history" && <HistoryPanel entries={history} language={language} onClear={() => { void clearHistory().then(() => setHistory([])).catch(() => {}); }} onReuse={entry => { const s = entry.settings; if (typeof s.quality === "number") setQuality(s.quality); if (typeof s.width === "number") setWidth(s.width); if (typeof s.height === "number") setHeight(s.height); if (typeof s.keep_metadata === "boolean") setKeepMetadata(s.keep_metadata); if (typeof s.bitrate === "number") setBitrate(s.bitrate); if (typeof s.resolution === "number") setResolution(s.resolution); if (typeof s.fps === "number") setFps(s.fps); if (typeof s.video_quality === "string") setVideoQuality(s.video_quality); selectView("all"); setFormat(entry.outputFormat); updateJobs(current => current.map(job => optionsFor(job.descriptor, availableFormats, serverCapabilities).includes(entry.outputFormat) ? { ...job, settings: { ...job.settings, output: entry.outputFormat } } : job)); }} />}
      {activeView === "about" && <section id="about" className="about-section glass"><h2>{t.aboutTitle}</h2><p>{t.aboutText}</p><p>{t.aboutLimits}</p><a href="https://github.com/Sver0411/ConvertBox" target="_blank" rel="noopener noreferrer">GitHub ↗</a></section>}
    </main>
    </div>
    {dragging && <div className="drag-overlay" aria-hidden="true"><UploadCloud size={42} /><strong>{t.dropOverlay}</strong></div>}
  </div>;
}
