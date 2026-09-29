"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, CircleAlert, FileImage, FolderPlus, LockKeyhole, RotateCcw, Trash2, UploadCloud, X } from "lucide-react";
import { IMAGE_FORMATS } from "@core/capabilities";
import { outputFilename } from "@core/filename";
import { detectFileType } from "@detection/detect";
import type { ConversionJob, ConversionSettings, ImageFormat } from "@shared/index";
import { browserCanEncode, convertImage } from "@/lib/image-converter";
import { downloadBlob, downloadZip } from "@/lib/download";
import { copy, localizeError, type Language } from "@/lib/messages";

const MAX_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const CONCURRENCY = 2;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 ** 2 ? "KB" : "MB";
  return `${(bytes / (unit === "KB" ? 1024 : 1024 ** 2)).toFixed(1)} ${unit}`;
}

export default function Workspace() {
  const [language, setLanguage] = useState<Language>("zh");
  const t = copy[language];
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const jobsRef = useRef<ConversionJob[]>([]);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(85);
  const [availableFormats, setAvailableFormats] = useState<ImageFormat[]>(["jpg", "png"]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "limit" | "partial" | "zip"; count?: number } | null>(null);
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

  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);

  const addFiles = useCallback(async (files: File[]) => {
    setNotice(null);
    const remaining = MAX_FILES - jobsRef.current.length;
    if (remaining <= 0) { setNotice({ type: "limit" }); return; }
    if (files.length > remaining) setNotice({ type: "partial", count: remaining });
    const additions = await Promise.all(files.slice(0, remaining).map(async file => {
      const descriptor = await detectFileType(file);
      if (file.size > MAX_INPUT_SIZE) descriptor.error = `File exceeds the ${humanSize(MAX_INPUT_SIZE)} local limit.`;
      if (descriptor.error) descriptor.category = "unsupported";
      return {
        id: crypto.randomUUID(), file, descriptor, settings: { output: format, quality },
        status: descriptor.error ? "FAILED" : "CREATED", stage: "queued", createdAt: Date.now(),
        error: descriptor.error,
      } satisfies ConversionJob;
    }));
    updateJobs(current => [...current, ...additions]);
  }, [format, quality, updateJobs]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }, [addFiles]);

  const patchJob = useCallback((id: string, patch: Partial<ConversionJob>) => {
    updateJobs(current => current.map(job => job.id === id ? { ...job, ...patch } : job));
  }, [updateJobs]);

  const runBatch = useCallback(async () => {
    if (busy) return;
    const pending = jobsRef.current.filter(job => job.descriptor.category === "image" && ["CREATED", "FAILED", "CANCELLED"].includes(job.status));
    if (!pending.length) return;
    const settings: ConversionSettings = { output: format, quality };
    setBusy(true);
    updateJobs(current => current.map(job => pending.some(item => item.id === job.id)
      ? { ...job, settings, status: "QUEUED", stage: "queued", error: undefined, output: undefined }
      : job));
    let cursor = 0;
    const runOne = async () => {
      while (cursor < pending.length) {
        const job = pending[cursor++];
        if (jobsRef.current.find(item => item.id === job.id)?.status === "CANCELLED") continue;
        const controller = new AbortController();
        controllers.current.set(job.id, controller);
        if (controller.signal.aborted) continue;
        patchJob(job.id, { status: "PROCESSING", startedAt: Date.now() });
        try {
          const blob = await convertImage(job.file, settings, stage => patchJob(job.id, { stage }), controller.signal);
          patchJob(job.id, {
            status: "COMPLETED", stage: "completed", output: blob,
            outputName: outputFilename(job.file.name, settings.output), completedAt: Date.now(),
          });
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
  }, [busy, format, quality, patchJob, updateJobs]);

  const cancelJob = (id: string) => {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    else patchJob(id, { status: "CANCELLED" });
  };

  const removeJob = (id: string) => {
    controllers.current.get(id)?.abort();
    updateJobs(current => current.filter(job => job.id !== id));
  };

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault(); fileInput.current?.click();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault(); void runBatch();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [runBatch]);

  const supported = jobs.filter(job => job.descriptor.category === "image");
  const completed = supported.filter(job => job.status === "COMPLETED");
  const failed = jobs.filter(job => job.status === "FAILED");
  const settled = supported.filter(job => ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)).length;
  const zipBytes = completed.reduce((sum, job) => sum + (job.output?.size ?? 0), 0);
  const canZip = completed.length > 1 && zipBytes <= MAX_ZIP_BYTES;
  const pendingCount = supported.filter(job => ["CREATED", "FAILED", "CANCELLED"].includes(job.status)).length;
  const noticeText = notice?.type === "limit" ? t.limit : notice?.type === "partial" ? t.partial(notice.count ?? 0) : notice?.type === "zip" ? t.zipError : "";

  return <div className="site-shell" onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }} onDragOver={event => event.preventDefault()} onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={onDrop}>
    <header className="site-header glass">
      <nav aria-label={language === "zh" ? "主导航" : "Main navigation"}><a className="nav-active" href="#convert">{t.convert}</a><a href="#about">{t.about}</a></nav>
      <div className="header-end"><span className="header-private"><LockKeyhole size={14} /> {t.localBadge}</span><button className="language-switch" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? "Switch to English" : "切换为中文"}>{language === "zh" ? "EN" : "中文"}</button></div>
    </header>

    <main id="top">
      <section className={`hero ${jobs.length ? "hero-compact" : ""}`} id="convert">
        <h1>{t.heroTitle}</h1>
        <p className="hero-copy">{t.heroSub}</p>
      </section>

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple hidden onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} aria-label={t.chooseFiles} />

      {!jobs.length ? <section className={`drop-zone glass ${dragging ? "is-dragging" : ""}`}>
        <div className="drop-icon"><UploadCloud size={28} strokeWidth={1.6} /></div>
        <h2>{t.dropTitle}</h2>
        <p>{t.dropSub}</p>
        <button className="primary-button" onClick={() => fileInput.current?.click()}><FolderPlus size={18} /> {t.chooseFiles} <ArrowRight size={17} /></button>
        <span className="formats-line">JPG <span>·</span> PNG <span>·</span> WEBP</span>
      </section> : <section className="workspace glass" aria-label={t.workspace}>
        <div className="workspace-top"><div><h2>{t.yourFiles} <span className="count-badge">{jobs.length}</span></h2><p>{pendingCount ? t.readyCount(pendingCount) : t.completeCount(completed.length)}{jobs.length - supported.length ? ` · ${t.unsupportedCount(jobs.length - supported.length)}` : ""}</p></div><button className="secondary-button" onClick={() => fileInput.current?.click()}><FolderPlus size={17} /> {t.addFiles}</button></div>
        <div className="settings-panel"><div className="setting-field"><label htmlFor="format">{t.convertTo}</label><div className="select-wrap"><select id="format" value={format} onChange={event => setFormat(event.target.value as ImageFormat)} disabled={busy}>{availableFormats.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select><ChevronDown size={16} /></div></div><div className="setting-field quality-field"><label htmlFor="quality">{t.quality} <span>{quality}%</span></label><input id="quality" type="range" min="1" max="100" value={quality} onChange={event => setQuality(Number(event.target.value))} disabled={busy || format === "png"} /><small>{format === "png" ? t.pngQuality : t.otherQuality}</small></div><div className="setting-note"><LockKeyhole size={17} /><span><strong>{t.localTitle}</strong><br />{t.localDetail}</span></div></div>
        {noticeText && <p className="notice" role="status"><CircleAlert size={16} />{noticeText}</p>}
        <div className="file-list" role="list">{jobs.map(job => <div className="file-row" role="listitem" key={job.id}>
          <div className={`file-icon ${job.status === "FAILED" ? "file-icon-error" : ""}`}><FileImage size={21} strokeWidth={1.7} /></div>
          <div className="file-main"><div className="file-name" title={job.file.name}>{job.file.name}</div><div className="file-sub">{humanSize(job.file.size)} <span>·</span> {job.descriptor.detectedType.toUpperCase()}{job.status === "COMPLETED" && job.output ? <> <span>→</span> {job.settings.output.toUpperCase()} <span>·</span> {humanSize(job.output.size)}</> : null}</div>{job.error && <div className="file-error">{localizeError(job.error, language)}</div>}</div>
          <div className={`status-pill status-${job.status.toLowerCase()}`}>{job.status === "COMPLETED" && <Check size={13} />}{job.status === "FAILED" && <CircleAlert size={13} />}{job.status === "PROCESSING" ? job.stage === "encoding" ? t.encoding : t.decoding : t.status[job.status]}</div>
          <div className="row-actions">{job.status === "COMPLETED" && job.output && job.outputName && <button className="icon-button" title={t.download} aria-label={`${t.download} ${job.outputName}`} onClick={() => downloadBlob(job.output!, job.outputName!)}><ArrowDownToLine size={18} /></button>}{(job.status === "PROCESSING" || job.status === "QUEUED") && <button className="icon-button" title={t.cancel} aria-label={`${t.cancel} ${job.file.name}`} onClick={() => cancelJob(job.id)}><X size={18} /></button>}{(job.status === "FAILED" || job.status === "CANCELLED") && job.descriptor.category === "image" && <button className="icon-button" title={t.retry} aria-label={`${t.retry} ${job.file.name}`} onClick={() => { patchJob(job.id, { status: "CREATED", error: undefined }); }}><RotateCcw size={17} /></button>}<button className="icon-button muted-action" title={t.remove} aria-label={`${t.remove} ${job.file.name}`} onClick={() => removeJob(job.id)}><Trash2 size={17} /></button></div>
        </div>)}</div>
        <div className="workspace-footer"><div className="progress-side">{busy ? <><div className="progress-label"><span>{t.convertProgress}</span><strong>{settled} / {supported.length}</strong></div><div className="progress-track" role="progressbar" aria-valuenow={settled} aria-valuemin={0} aria-valuemax={supported.length}><div style={{ width: `${supported.length ? (settled / supported.length) * 100 : 0}%` }} /></div></> : completed.length ? <div className="summary"><Check size={16} /> {t.completeSummary(completed.length)}{failed.filter(job => job.descriptor.category === "image").length ? ` · ${t.failedSummary(failed.filter(job => job.descriptor.category === "image").length)}` : ""}</div> : <div className="summary-sub">{supported.length ? t.ready : t.addSupported}</div>}</div><div className="footer-actions">{canZip && <button className="secondary-button" onClick={() => { void downloadZip(completed.filter(job => job.output && job.outputName).map(job => ({ name: job.outputName!, blob: job.output! }))).catch(() => setNotice({ type: "zip" })); }}><ArrowDownToLine size={17} /> {t.downloadAll}</button>}{completed.length > 1 && !canZip && <span className="zip-note">{t.zipLimit}</span>}{(pendingCount > 0 || busy) && <button className="primary-button" disabled={busy || !pendingCount || !availableFormats.includes(format)} onClick={() => void runBatch()}>{busy ? t.converting : completed.length ? t.convertRemaining : t.convertFiles}<ArrowRight size={17} /></button>}</div></div>
      </section>}

      <section id="about" className="about-section"><h2>{t.aboutTitle}</h2><p>{t.aboutText}</p><p>{t.aboutLimits}</p></section>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} ConvertBox</span><span>{t.footer}</span></footer>
    {dragging && <div className="drag-overlay" aria-hidden="true"><UploadCloud size={42} /><strong>{t.dropOverlay}</strong></div>}
  </div>;
}
