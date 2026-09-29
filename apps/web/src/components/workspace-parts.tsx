"use client";

import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, Check, CircleAlert, FileImage, FileText, Film, FolderPlus, Music2, RotateCcw, Trash2, UploadCloud, X } from "lucide-react";
import type { ConversionJob } from "@shared/index";
import { downloadBlob, downloadZip } from "@/lib/download";
import { isStale, type EffectiveControls } from "@/lib/effective-settings";
import { copy, localizeError, type Language } from "@/lib/messages";
import { downloadServerJob } from "@/lib/server-api";
import type { ConversionView } from "@/lib/workspace-views";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 ** 2 ? "KB" : "MB";
  return `${(bytes / (unit === "KB" ? 1024 : 1024 ** 2)).toFixed(1)} ${unit}`;
}

export function DropZone({ language, dragging, onChoose }: { language: Language; dragging: boolean; onChoose: () => void }) {
  const t = copy[language];
  return <section className={`drop-zone glass ${dragging ? "is-dragging" : ""}`}>
    <div className="drop-icon"><UploadCloud size={28} strokeWidth={1.6} /></div>
    <h2>{t.dropTitle}</h2><p>{t.dropSub}</p>
    <button className="primary-button" onClick={onChoose}><FolderPlus size={18} /> {t.chooseFiles} <ArrowRight size={17} /></button>
  </section>;
}

export function FileList({ children }: { children: React.ReactNode }) {
  return <div className="file-list" role="list">{children}</div>;
}

interface FileRowProps {
  job: ConversionJob;
  language: Language;
  view: ConversionView;
  controls: EffectiveControls;
  options: string[];
  showTarget: boolean;
  local: boolean;
  busy: boolean;
  groupKind: "merge" | "images" | null;
  isFirst: boolean;
  isLast: boolean;
  onTarget: (value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onReconvert: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

export function FileRow({ job, language, view, controls, options, showTarget, local, busy, groupKind, isFirst, isLast, onTarget, onMove, onReconvert, onCancel, onRetry, onRemove }: FileRowProps) {
  const t = copy[language];
  const stale = isStale(job, controls, view);
  const outputSize = job.outputSize ?? job.output?.size ?? 0;
  return <div className="file-row" role="listitem">
    <div className={`file-icon ${job.status === "FAILED" ? "file-icon-error" : ""}`}>{job.descriptor.category === "video" ? <Film size={21} /> : job.descriptor.category === "audio" ? <Music2 size={21} /> : job.descriptor.category === "office" || job.descriptor.category === "pdf" ? <FileText size={21} /> : <FileImage size={21} strokeWidth={1.7} />}</div>
    <div className="file-main">
      <div className="file-name" title={job.file.name}>{job.file.name}</div>
      <div className="file-sub">{job.file.size ? humanSize(job.file.size) : t.groupResult} <span>·</span> {job.descriptor.detectedType.toUpperCase()} <span>·</span> {(job.output || !job.serverId && local) ? t.localShort : t.serverShort}{job.status === "COMPLETED" && job.outputName ? <> <span>→</span> {job.outputName.split(".").pop()?.toUpperCase()} <span>·</span> {humanSize(outputSize)}{job.file.size > 0 ? <> <span>·</span> {t.sizeChange(Math.round((1 - outputSize / job.file.size) * 100))}</> : null}</> : null}</div>
      {job.error && <div className="file-error">{localizeError(job.error, language, job.errorCode)}</div>}
    </div>
    {showTarget && <select className="row-target" aria-label={`${job.file.name} ${t.convertTo}`} value={job.settings.output} onChange={event => onTarget(event.target.value)} disabled={busy}>{options.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select>}
    <div className={`status-pill status-${job.status.toLowerCase()}`}>{job.status === "COMPLETED" && !stale && <Check size={13} />}{job.status === "FAILED" && <CircleAlert size={13} />}{job.stage === "uploading" && job.status === "QUEUED" ? t.uploading : job.status === "PROCESSING" ? job.progress != null ? `${Math.round(job.progress * 100)}%` : job.stage === "encoding" ? t.encoding : job.stage === "decoding" ? t.decoding : t.processing : stale ? t.settingsChanged : t.status[job.status]}</div>
    <div className="row-actions">
      {groupKind && job.file.size > 0 && <><button className="icon-button" title={t.moveUp} aria-label={`${t.moveUp} ${job.file.name}`} onClick={() => onMove(-1)} disabled={busy || isFirst}><ArrowUp size={15} /></button><button className="icon-button" title={t.moveDown} aria-label={`${t.moveDown} ${job.file.name}`} onClick={() => onMove(1)} disabled={busy || isLast}><ArrowDown size={15} /></button></>}
      {job.outputName && (job.output || job.serverId) && <button className="icon-button" title={stale || job.status !== "COMPLETED" ? t.downloadOld : t.download} aria-label={`${stale || job.status !== "COMPLETED" ? t.downloadOld : t.download} ${job.outputName}`} onClick={() => job.serverId ? downloadServerJob(job.serverId) : job.output && downloadBlob(job.output, job.outputName!)}><ArrowDownToLine size={18} /></button>}
      {stale && <button className="text-button" onClick={onReconvert} disabled={busy}>{t.reconvert}</button>}
      {(job.status === "QUEUED" || (job.status === "PROCESSING" && (job.stage === "uploading" || local))) && <button className="icon-button" title={t.cancel} aria-label={`${t.cancel} ${job.file.name}`} onClick={onCancel}><X size={18} /></button>}
      {(job.status === "FAILED" || job.status === "CANCELLED") && job.descriptor.category !== "unsupported" && <button className="icon-button" title={t.retry} aria-label={`${t.retry} ${job.file.name}`} onClick={onRetry}><RotateCcw size={17} /></button>}
      {!(job.serverId && job.status === "PROCESSING") && <button className="icon-button muted-action" title={t.remove} aria-label={`${t.remove} ${job.file.name}`} onClick={onRemove}><Trash2 size={17} /></button>}
    </div>
  </div>;
}

interface FooterProps {
  language: Language;
  busy: boolean;
  settled: number;
  supportedCount: number;
  completed: ConversionJob[];
  failedCount: number;
  canZip: boolean;
  groupKind: "merge" | "images" | null;
  pendingCount: number;
  staleCount: number;
  onBatch: () => void;
  onGroup: (kind: "merge" | "images") => void;
  onZipError: () => void;
}

export function WorkspaceFooter({ language, busy, settled, supportedCount, completed, failedCount, canZip, groupKind, pendingCount, staleCount, onBatch, onGroup, onZipError }: FooterProps) {
  const t = copy[language];
  return <div className="workspace-footer">
    <div className="progress-side">{busy ? <><div className="progress-label"><span>{t.convertProgress}</span><strong>{settled} / {supportedCount}</strong></div><div className="progress-track" role="progressbar" aria-valuenow={settled} aria-valuemin={0} aria-valuemax={supportedCount}><div style={{ width: `${supportedCount ? (settled / supportedCount) * 100 : 0}%` }} /></div></> : completed.length ? <div className="summary"><Check size={16} /> {t.completeSummary(completed.length)}{failedCount ? ` · ${t.failedSummary(failedCount)}` : ""}</div> : <div className="summary-sub">{supportedCount ? t.ready : t.addSupported}</div>}</div>
    <div className="footer-actions">
      {canZip && <button className="secondary-button" onClick={() => { void downloadZip(completed.filter(job => job.output && job.outputName).map(job => ({ name: job.outputName!, blob: job.output! }))).catch(onZipError); }}><ArrowDownToLine size={17} /> {t.downloadAll}</button>}
      {completed.length > 1 && completed.every(job => job.output) && !canZip && <span className="zip-note">{t.zipLimit}</span>}
      {groupKind ? <button className="primary-button" disabled={busy} onClick={() => onGroup(groupKind)}>{groupKind === "merge" ? t.pdfMerge : t.imagesToPdf}<ArrowRight size={17} /></button> : (pendingCount > 0 || busy) && <button className="primary-button" disabled={busy || !pendingCount} onClick={onBatch}>{busy ? t.converting : staleCount === pendingCount ? t.reconvert : completed.length ? t.convertRemaining : t.convertFiles}<ArrowRight size={17} /></button>}
    </div>
  </div>;
}
