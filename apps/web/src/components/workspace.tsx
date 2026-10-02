"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleAlert, FolderPlus } from "lucide-react";
import { IMAGE_FORMATS, transitionStatus } from "@core/capabilities";
import { outputFilename } from "@core/filename";
import { detectFileType } from "@detection/detect";
import type { ConversionJob, ConversionSettings, FileDescriptor, ImageFormat } from "@shared/index";
import { browserCanEncode, convertImage, type ImageMetrics } from "@/lib/image-converter";
import { copy, type Language } from "@/lib/messages";
import { createServerJob, deleteServerJob, getServerCapabilities, pollServerJob, ServerApiError, type ServerCapabilities } from "@/lib/server-api";
import HistoryPanel from "@/components/history-panel";
import { clearHistory, listHistory, saveHistory, type HistoryEntry } from "@/lib/history";
import { defaultPresets, loadCustomPresets, storeCustomPresets, type Preset } from "@/lib/presets";
import { isConversionView, preferredOutput, toolViews, viewAccepts, viewInputAccept, viewOutputs, type ConversionView, type ToolView } from "@/lib/workspace-views";
import { DEFAULT_LOCAL_MEMORY_BUDGET, estimatedImageBytes } from "@/lib/local-scheduler";
import { useConversionQueue } from "@/hooks/useConversionQueue";
import { effectiveSettings, isStale, type EffectiveControls } from "@/lib/effective-settings";
import { DropZone, FileList, FileRow, WorkspaceFooter } from "@/components/workspace-parts";
import { ImageSettings, MediaSettings, PdfSettings, PresetControls, QualitySettings } from "@/components/workspace-settings";
import { WorkspaceShell } from "@/components/workspace-shell";
import { recordToolUse } from "@/lib/tools/preferences";
import type { ToolDefinition } from "@/lib/tools/registry";

const MAX_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_ZIP_BYTES = 64 * 1024 * 1024;
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

function canUseLocal(descriptor: FileDescriptor, settings: { output: string; width?: number; height?: number; quality: number }, bytes: number, keepMetadata: boolean): boolean {
  return isLocal(descriptor.detectedType, settings.output) && bytes <= MAX_INPUT_SIZE && !keepMetadata && estimatedImageBytes(descriptor, settings) <= DEFAULT_LOCAL_MEMORY_BUDGET;
}

export default function Workspace({ initialView = "all", initialOperation = "convert", initialToolId }: { initialView?: ConversionView; initialOperation?: string; initialToolId?: ToolDefinition["id"] } = {}) {
  const [language, setLanguage] = useState<Language>("zh");
  const t = copy[language];
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [activeView, setActiveView] = useState<ToolView>(initialView);
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
  const [pdfOperation, setPdfOperation] = useState(initialOperation);
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
  const effectiveControls: EffectiveControls = useMemo(() => ({ quality, width, height, keepMetadata, pages, dpi, rotation, pdfOperation, bitrate, sampleRate, resolution, fps, videoQuality, pageSize, orientation, margin }), [quality, width, height, keepMetadata, pages, dpi, rotation, pdfOperation, bitrate, sampleRate, resolution, fps, videoQuality, pageSize, orientation, margin]);
  const fileInput = useRef<HTMLInputElement>(null);
  const { controllers, localScheduler, runJobs } = useConversionQueue();
  const dragDepth = useRef(0);

  const updateJobs = useCallback((fn: (current: ConversionJob[]) => ConversionJob[]) => {
    jobsRef.current = fn(jobsRef.current);
    setJobs([...jobsRef.current]);
  }, []);

  useEffect(() => {
    const supported = IMAGE_FORMATS.filter(browserCanEncode);
    setAvailableFormats(supported);
    if (!supported.includes("webp")) setFormat(supported.includes("png") ? "png" : "jpg");
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
      setActiveView(toolViews.find(item => item === value) ?? initialView);
    };
    readView();
    window.addEventListener("popstate", readView);
    return () => window.removeEventListener("popstate", readView);
  }, [initialView]);

  useEffect(() => { if (initialToolId) recordToolUse(initialToolId); }, [initialToolId]);

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
      const localEligible = canUseLocal(descriptor, { output: selected, quality, width, height }, file.size, keepMetadata);
      const serverEligible = activeServer?.server.find(item => item.input === descriptor.detectedType)?.outputs.includes(selected) ?? false;
      const limit = localEligible ? MAX_INPUT_SIZE : activeServer?.maxUploadSize ?? 0;
      if (!descriptor.error && !viewAccepts(view, descriptor)) descriptor.error = "File is not suitable for this workspace.";
      if (!descriptor.error && isLocal(descriptor.detectedType, selected) && !localEligible && !serverEligible) descriptor.error = "Image exceeds the local memory budget.";
      if (file.size > limit) descriptor.error = "File exceeds the available processing limit.";
      if (!descriptor.error && options.length === 0) descriptor.error = "Server converter is unavailable for this file.";
      if (descriptor.error) descriptor.category = "unsupported";
      return {
        id: crypto.randomUUID(), workspace: view, file, descriptor, settings: { output: selected, quality },
        status: descriptor.error ? "FAILED" : "CREATED", stage: "queued", createdAt: Date.now(),
        error: descriptor.error, errorCode: descriptor.errorCode,
      } satisfies ConversionJob;
    }));
    if (additions[0]?.settings.output) setFormat(additions[0].settings.output);
    updateJobs(current => [...current, ...additions]);
  }, [activeView, format, quality, width, height, keepMetadata, availableFormats, serverCapabilities, updateJobs]);

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
    updateJobs(current => current.map(job => job.id === id ? { ...job, ...patch, status: patch.status ? transitionStatus(job.status, patch.status) : job.status } : job));
  }, [updateJobs]);

  const runBatch = useCallback(async (onlyId?: string) => {
    if (busy || !isConversionView(activeView)) return;
    const view = isConversionView(activeView) ? activeView : "all";
    const pending = jobsRef.current.filter(job => (!onlyId || job.id === onlyId) && job.descriptor.category !== "unsupported" && viewAccepts(view, job.descriptor) && (["CREATED", "FAILED", "CANCELLED"].includes(job.status) || isStale(job, effectiveControls, view)));
    if (!pending.length) return;
    setBusy(true);
    updateJobs(current => current.map(job => pending.some(item => item.id === job.id)
      ? { ...job, status: transitionStatus(job.status, "QUEUED"), stage: "queued", error: undefined, errorCode: undefined, progress: null }
      : job));
    try {
      await runJobs(pending, async job => {
        if (jobsRef.current.find(item => item.id === job.id)?.status === "CANCELLED") return;
        const controller = new AbortController();
        controllers.current.set(job.id, controller);
        if (controller.signal.aborted) return;
        const settings = { ...job.settings, quality, width, height, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality };
        const settingsKey = effectiveSettings(job, effectiveControls, view);
        const local = canUseLocal(job.descriptor, settings, job.file.size, keepMetadata);
        const cost = estimatedImageBytes(job.descriptor, settings);
        patchJob(job.id, { status: local ? "PROCESSING" : "QUEUED", stage: local ? "decoding" : "uploading", settings, startedAt: Date.now() });
        try {
          if (local) {
            const localSettings: ConversionSettings = { output: settings.output as ImageFormat, quality, width, height };
            if (job.file.size > MAX_INPUT_SIZE) throw new Error("File exceeds the 25 MB local limit.");
            const blob = await localScheduler.current.run(cost, controller.signal, () => convertImage(job.file, localSettings, stage => patchJob(job.id, { stage }), controller.signal, metrics => setDebugMetrics({ name: job.file.name, metrics })));
            patchJob(job.id, { status: "COMPLETED", stage: "completed", output: blob, serverId: undefined, outputSize: blob.size,
              outputName: outputFilename(job.file.name, localSettings.output), completedAt: Date.now(), lastCompletedSettings: settingsKey });
            recordHistory(job, localSettings.output, blob.size, { quality, width, height });
          } else {
            const operation = job.descriptor.category === "pdf" && activeView !== "word" ? pdfOperation : "convert";
            const created = await createServerJob([job.file], settings.output, operation, { quality, width, height, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality, page_size: pageSize, orientation, margin, keep_metadata: keepMetadata }, controller.signal);
            patchJob(job.id, { pendingServerId: created.id, status: "QUEUED", stage: "queued" });
            const finished = await pollServerJob(created.id, state => patchJob(job.id, {
              status: state.status === "QUEUED" ? "QUEUED" : state.status === "PROCESSING" ? "PROCESSING" : state.status === "FAILED" ? "FAILED" : state.status === "COMPLETED" ? "COMPLETED" : "CANCELLED",
              stage: state.status === "COMPLETED" ? "completed" : "processing", progress: state.progress,
              error: state.error ?? undefined, errorCode: state.errorCode ?? undefined,
            }), controller.signal);
            if (finished.status !== "COMPLETED") throw new ServerApiError(finished.error ?? "Server conversion failed", finished.errorCode ?? "CONVERSION_FAILED", 422);
            patchJob(job.id, { status: "COMPLETED", output: undefined, serverId: created.id, pendingServerId: undefined, outputName: finished.outputName ?? undefined, outputSize: finished.outputSize ?? undefined, completedAt: Date.now(), lastCompletedSettings: settingsKey });
            if (job.serverId && job.serverId !== created.id) void deleteServerJob(job.serverId).catch(() => {});
            recordHistory(job, settings.output, finished.outputSize ?? 0, { quality, width, height, keep_metadata: keepMetadata, pages, dpi, rotation, bitrate, sample_rate: sampleRate, resolution, fps, video_quality: videoQuality });
          }
        } catch (error) {
          const cancelled = error instanceof DOMException && error.name === "AbortError";
          patchJob(job.id, { status: cancelled ? "CANCELLED" : "FAILED", error: cancelled ? undefined : error instanceof Error ? error.message : "Conversion failed.", errorCode: error instanceof ServerApiError ? error.code : undefined });
        } finally {
          controllers.current.delete(job.id);
        }
      });
    } finally {
      setBusy(false);
    }
  }, [activeView, busy, quality, width, height, keepMetadata, pages, dpi, rotation, bitrate, sampleRate, resolution, fps, videoQuality, pageSize, orientation, margin, pdfOperation, effectiveControls, patchJob, updateJobs, recordHistory, controllers, localScheduler, runJobs]);

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
      settings: { output: "pdf", quality }, status: "QUEUED", stage: "uploading", createdAt: Date.now(),
    };
    setBusy(true);
    updateJobs(current => [...current, result]);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    try {
      const created = await createServerJob(sources.map(job => job.file), "pdf", kind === "merge" ? "merge" : "convert", { quality, page_size: pageSize, orientation, margin }, controller.signal);
      patchJob(id, { pendingServerId: created.id, status: "QUEUED", stage: "queued" });
      const finished = await pollServerJob(created.id, state => patchJob(id, {
        status: state.status === "COMPLETED" ? "COMPLETED" : state.status === "FAILED" ? "FAILED" : state.status === "PROCESSING" ? "PROCESSING" : "QUEUED",
        stage: state.status === "COMPLETED" ? "completed" : "processing", progress: state.progress,
        error: state.error ?? undefined, outputName: state.outputName ?? undefined, outputSize: state.outputSize ?? undefined,
      }), controller.signal);
      if (finished.status !== "COMPLETED") throw new Error(finished.error ?? "Server conversion failed");
      patchJob(id, { status: "COMPLETED", serverId: created.id, pendingServerId: undefined, completedAt: Date.now() });
      recordHistory(result, "pdf", finished.outputSize ?? 0, { quality });
    } catch (error) {
      patchJob(id, { status: "FAILED", error: error instanceof Error ? error.message : "Server conversion failed", errorCode: error instanceof ServerApiError ? error.code : undefined });
    } finally {
      controllers.current.delete(id);
      setBusy(false);
    }
  }, [activeView, busy, quality, pageSize, orientation, margin, patchJob, updateJobs, recordHistory, controllers]);

  const cancelJob = (id: string) => {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    const job = jobsRef.current.find(item => item.id === id);
    if (job?.pendingServerId && job.status === "QUEUED") void deleteServerJob(job.pendingServerId).catch(() => {});
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
  const pendingCount = supported.filter(job => ["CREATED", "FAILED", "CANCELLED"].includes(job.status) || isStale(job, effectiveControls, view)).length;
  const staleCount = supported.filter(job => isStale(job, effectiveControls, view)).length;
  const noticeText = notice?.type === "limit" ? t.limit : notice?.type === "partial" ? t.partial(notice.count ?? 0) : notice?.type === "zip" ? t.zipError : notice?.type === "server" ? t.serverUnavailable : "";
  const categories = new Set(supported.map(job => job.descriptor.category));
  const oneCategory = categories.size === 1 ? supported[0]?.descriptor.category : null;
  const bulkOptions = supported.length ? optionsForMode(supported[0].descriptor, availableFormats, serverCapabilities, view).filter(option => supported.every(job => optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(option))) : availableFormats;
  const shownOptions = oneCategory === "pdf" && view !== "word" && pdfOperation !== "convert" ? ["pdf"] : bulkOptions;
  const groupKind = oneCategory === "pdf" && view !== "word" && pdfOperation === "merge" && supported.filter(job => job.file.size > 0).length >= 2 ? "merge" : oneCategory === "image" && format === "pdf" && supported.filter(job => job.file.size > 0).length >= 2 ? "images" : null;

  return <WorkspaceShell jobs={jobs} activeView={activeView} language={language} theme={theme} dragging={dragging} toolId={initialToolId}
    onView={selectView} onTheme={setTheme} onLanguage={() => setLanguage(language === "zh" ? "en" : "zh")}
    onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }}
    onDragOver={event => event.preventDefault()}
    onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
    onDrop={onDrop}>
      <input ref={fileInput} type="file" multiple hidden accept={isConversionView(activeView) ? viewInputAccept[activeView] : ""} onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} aria-label={t.chooseFiles} />
      {isConversionView(activeView) && <>
      <section className={`hero ${visibleJobs.length ? "hero-compact" : ""}`} id="convert">
        <h1>{t.viewTitles[activeView]}</h1>
        <p className="hero-copy">{t.viewHelp[activeView]}</p>
      </section>

      {!visibleJobs.length ? <DropZone language={language} dragging={dragging} onChoose={() => fileInput.current?.click()} /> : <section className="workspace glass" aria-label={t.workspace}>
        <div className="workspace-top"><div><h2>{t.yourFiles} <span className="count-badge">{visibleJobs.length}</span></h2><p>{pendingCount ? t.readyCount(pendingCount) : t.completeCount(completed.length)}{visibleJobs.length - supported.length ? ` · ${t.unsupportedCount(visibleJobs.length - supported.length)}` : ""}</p></div><button className="secondary-button" onClick={() => fileInput.current?.click()}><FolderPlus size={17} /> {t.addFiles}</button></div>
        <div className={`settings-panel ${oneCategory === "pdf" && view !== "word" ? "pdf-settings-layout" : ""}`}>
          {(oneCategory === "image" || oneCategory === "audio" || oneCategory === "video") && <PresetControls language={language} presets={[...defaultPresets, ...customPresets].filter(item => item.category === oneCategory && supported.every(job => optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(item.output)))} choice={presetChoice} busy={busy} saving={savingPreset} name={newPresetName} hasSelectedCustom={customPresets.some(item => item.id === presetChoice)} onChoice={id => { setPresetChoice(id); const preset = [...defaultPresets, ...customPresets].find(item => item.id === id); if (preset) applyPreset(preset); }} onToggleSaving={() => setSavingPreset(value => !value)} onDelete={deletePreset} onName={setNewPresetName} onSave={savePreset} onCancelSaving={() => setSavingPreset(false)} />}
          {shownOptions.length > 0 && <div className="setting-field"><label htmlFor="format">{t.convertTo}</label><div className="select-wrap"><select id="format" value={shownOptions.includes(format) ? format : shownOptions[0]} onChange={event => { const selected = event.target.value; setFormat(selected); updateJobs(current => current.map(job => job.descriptor.category !== "unsupported" && viewAccepts(view, job.descriptor) && optionsForMode(job.descriptor, availableFormats, serverCapabilities, view).includes(selected) ? { ...job, settings: { ...job.settings, output: selected } } : job)); }} disabled={busy}>{shownOptions.map(item => <option key={item} value={item}>{item.toUpperCase()}{oneCategory === "pdf" && item === "docx" ? t.textOnly : ""}</option>)}</select><ChevronDown size={16} /></div></div>}
          {(oneCategory === "image" || (oneCategory === "pdf" && format === "jpg")) && <QualitySettings language={language} quality={quality} format={format} busy={busy} onQuality={setQuality} />}
          {oneCategory === "image" && <ImageSettings language={language} format={format} width={width} height={height} keepMetadata={keepMetadata} serverAvailable={!!serverCapabilities} busy={busy} pageSize={pageSize} orientation={orientation} margin={margin} onWidth={setWidth} onHeight={setHeight} onMetadata={setKeepMetadata} onPageSize={setPageSize} onOrientation={setOrientation} onMargin={setMargin} />}
          {oneCategory === "pdf" && view !== "word" && <PdfSettings language={language} operation={pdfOperation} format={format} pages={pages} dpi={dpi} rotation={rotation} supportedCount={supported.length} busy={busy} onOperation={next => { setPdfOperation(next); const output = next === "convert" ? "png" : "pdf"; setFormat(output); updateJobs(current => current.map(job => job.descriptor.category === "pdf" ? { ...job, settings: { ...job.settings, output } } : job)); }} onPages={setPages} onDpi={setDpi} onRotation={setRotation} />}
          {(oneCategory === "audio" || oneCategory === "video") && <MediaSettings language={language} category={oneCategory} bitrate={bitrate} sampleRate={sampleRate} resolution={resolution} fps={fps} videoQuality={videoQuality} busy={busy} onBitrate={setBitrate} onSampleRate={setSampleRate} onResolution={setResolution} onFps={setFps} onVideoQuality={setVideoQuality} />}
        </div>
        {noticeText && <p className="notice" role="status"><CircleAlert size={16} />{noticeText}</p>}
        <FileList>{visibleJobs.map((job, index) => <FileRow key={job.id} job={job} language={language} view={view} controls={effectiveControls}
          options={optionsForMode(job.descriptor, availableFormats, serverCapabilities, view)}
          showTarget={job.descriptor.category !== "unsupported" && job.status !== "COMPLETED" && shownOptions.length === 0 && (pdfOperation === "convert" || view === "word")}
          local={canUseLocal(job.descriptor, { ...job.settings, width, height }, job.file.size, keepMetadata)} busy={busy} groupKind={groupKind}
          isFirst={index === 0} isLast={index === visibleJobs.length - 1}
          onTarget={output => patchJob(job.id, { settings: { ...job.settings, output } })}
          onMove={direction => moveJob(job.id, direction)} onReconvert={() => void runBatch(job.id)}
          onCancel={() => cancelJob(job.id)} onRetry={() => void runBatch(job.id)} onRemove={() => removeJob(job.id)} />)}</FileList>
        <WorkspaceFooter language={language} busy={busy} settled={settled} supportedCount={supported.length} completed={completed}
          failedCount={failed.filter(job => job.descriptor.category !== "unsupported").length} canZip={canZip} groupKind={groupKind}
          pendingCount={pendingCount} staleCount={staleCount} onBatch={() => void runBatch()} onGroup={kind => void runGroup(kind)}
          onZipError={() => setNotice({ type: "zip" })} />
      </section>}
      {showDebug && <section className="debug-metrics"><h2>Debug metrics</h2>{debugMetrics ? <pre>{JSON.stringify({ file: debugMetrics.name, ...debugMetrics.metrics, peakMemory: "unavailable" }, null, 2)}</pre> : <p>Run a local image conversion to collect timing data.</p>}</section>}
      </>}
      {activeView === "history" && <HistoryPanel entries={history} language={language} onClear={() => { void clearHistory().then(() => setHistory([])).catch(() => {}); }} onReuse={entry => { const s = entry.settings; if (typeof s.quality === "number") setQuality(s.quality); if (typeof s.width === "number") setWidth(s.width); if (typeof s.height === "number") setHeight(s.height); if (typeof s.keep_metadata === "boolean") setKeepMetadata(s.keep_metadata); if (typeof s.bitrate === "number") setBitrate(s.bitrate); if (typeof s.resolution === "number") setResolution(s.resolution); if (typeof s.fps === "number") setFps(s.fps); if (typeof s.video_quality === "string") setVideoQuality(s.video_quality); selectView("all"); setFormat(entry.outputFormat); updateJobs(current => current.map(job => optionsFor(job.descriptor, availableFormats, serverCapabilities).includes(entry.outputFormat) ? { ...job, settings: { ...job.settings, output: entry.outputFormat } } : job)); }} />}
      {activeView === "about" && <section id="about" className="about-section glass"><h2>{t.aboutTitle}</h2><p>{t.aboutText}</p><p>{t.aboutLimits}</p><a href="https://github.com/Sver0411/ConvertBox" target="_blank" rel="noopener noreferrer">GitHub ↗</a></section>}
  </WorkspaceShell>;
}
