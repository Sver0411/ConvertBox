"use client";

import { chinesePresetNames, type Preset } from "@/lib/presets";
import { copy, type Language } from "@/lib/messages";

type Category = "image" | "audio" | "video";

export function PresetControls({ language, presets, choice, busy, saving, name, hasSelectedCustom, onChoice, onToggleSaving, onDelete, onName, onSave, onCancelSaving }: {
  language: Language; presets: Preset[]; choice: string; busy: boolean; saving: boolean; name: string; hasSelectedCustom: boolean;
  onChoice: (id: string) => void; onToggleSaving: () => void; onDelete: () => void; onName: (name: string) => void; onSave: () => void; onCancelSaving: () => void;
}) {
  const t = copy[language];
  return <div className="preset-field"><label htmlFor="preset">{t.preset}</label><div className="preset-controls">
    <select id="preset" value={choice} onChange={event => onChoice(event.target.value)} disabled={busy}><option value="">{t.choosePreset}</option>{presets.map(item => <option key={item.id} value={item.id}>{language === "zh" ? chinesePresetNames[item.id] ?? item.name : item.name}</option>)}</select>
    <button className="text-button" onClick={onToggleSaving} disabled={busy}>{t.savePreset}</button>
    {hasSelectedCustom && <button className="text-button" onClick={onDelete} disabled={busy}>{t.deletePreset}</button>}
  </div>{saving && <div className="preset-controls"><input value={name} maxLength={50} placeholder={t.presetName} onChange={event => onName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") onSave(); if (event.key === "Escape") onCancelSaving(); }} /><button className="text-button" onClick={onSave} disabled={!name.trim()}>{t.save}</button></div>}</div>;
}

export function QualitySettings({ language, quality, format, busy, onQuality }: { language: Language; quality: number; format: string; busy: boolean; onQuality: (value: number) => void }) {
  const t = copy[language];
  return <div className="setting-field quality-field"><label htmlFor="quality">{t.quality} <span>{quality}%</span></label><input id="quality" type="range" min="1" max="100" value={quality} onChange={event => onQuality(Number(event.target.value))} disabled={busy || format === "png" || format === "pdf"} /><small>{format === "png" || format === "pdf" ? t.pngQuality : t.otherQuality}</small></div>;
}

export function ImageSettings({ language, format, width, height, keepMetadata, serverAvailable, busy, pageSize, orientation, margin, onWidth, onHeight, onMetadata, onPageSize, onOrientation, onMargin }: {
  language: Language; format: string; width: number; height: number; keepMetadata: boolean; serverAvailable: boolean; busy: boolean;
  pageSize: string; orientation: string; margin: string;
  onWidth: (value: number) => void; onHeight: (value: number) => void; onMetadata: (value: boolean) => void;
  onPageSize: (value: string) => void; onOrientation: (value: string) => void; onMargin: (value: string) => void;
}) {
  const t = copy[language];
  if (format === "pdf") return <div className="settings-extra"><div className="setting-field"><label htmlFor="page-size">{t.pageSize}</label><select id="page-size" value={pageSize} onChange={event => onPageSize(event.target.value)} disabled={busy}><option value="auto">{t.auto}</option><option value="a4">A4</option><option value="letter">Letter</option></select></div><div className="setting-field"><label htmlFor="orientation">{t.orientation}</label><select id="orientation" value={orientation} onChange={event => onOrientation(event.target.value)} disabled={busy}><option value="auto">{t.auto}</option><option value="portrait">{t.portrait}</option><option value="landscape">{t.landscape}</option></select></div><div className="setting-field"><label htmlFor="margin">{t.margin}</label><select id="margin" value={margin} onChange={event => onMargin(event.target.value)} disabled={busy}><option value="none">{t.none}</option><option value="small">{t.small}</option><option value="medium">{t.medium}</option><option value="large">{t.large}</option></select></div></div>;
  return <><div className="settings-extra"><div className="setting-field"><label htmlFor="width">{t.width}</label><input id="width" type="number" min="0" max="12000" value={width || ""} placeholder={t.original} onChange={event => onWidth(Number(event.target.value) || 0)} disabled={busy} /></div><div className="setting-field"><label htmlFor="height">{t.height}</label><input id="height" type="number" min="0" max="12000" value={height || ""} placeholder={t.original} onChange={event => onHeight(Number(event.target.value) || 0)} disabled={busy} /></div><small>{t.resizeHint}</small></div><div className="settings-extra"><div className="setting-field"><label htmlFor="metadata">{t.metadata}</label><select id="metadata" value={keepMetadata ? "keep" : "remove"} onChange={event => onMetadata(event.target.value === "keep")} disabled={busy || !serverAvailable}><option value="remove">{t.removeMetadata}</option>{serverAvailable && <option value="keep">{t.keepMetadata}</option>}</select></div></div></>;
}

export function PdfSettings({ language, operation, format, pages, dpi, rotation, supportedCount, busy, onOperation, onPages, onDpi, onRotation }: {
  language: Language; operation: string; format: string; pages: string; dpi: number; rotation: number; supportedCount: number; busy: boolean;
  onOperation: (value: string) => void; onPages: (value: string) => void; onDpi: (value: number) => void; onRotation: (value: number) => void;
}) {
  const t = copy[language];
  return <div className="settings-extra"><div className="setting-field"><label htmlFor="pdf-operation">{t.pdfAction}</label><select id="pdf-operation" value={operation} onChange={event => onOperation(event.target.value)} disabled={busy}><option value="convert">{t.pdfConvert}</option><option value="split">{t.pdfSplit}</option><option value="rotate">{t.pdfRotate}</option><option value="compress">{t.pdfCompress}</option>{supportedCount > 1 && <option value="merge">{t.pdfMerge}</option>}</select></div>{operation !== "merge" && <div className="setting-field"><label htmlFor="pages">{t.pages}</label><input id="pages" value={pages} onChange={event => onPages(event.target.value)} placeholder={operation === "split" ? "all / 1-3;4-6" : "all / 1-3,5"} disabled={busy} /></div>}{operation === "convert" && (format === "png" || format === "jpg") && <div className="setting-field"><label htmlFor="dpi">DPI</label><select id="dpi" value={dpi} onChange={event => onDpi(Number(event.target.value))} disabled={busy}>{[72, 144, 216, 300].map(value => <option key={value}>{value}</option>)}</select></div>}{operation === "rotate" && <div className="setting-field"><label htmlFor="rotation">{t.rotation}</label><select id="rotation" value={rotation} onChange={event => onRotation(Number(event.target.value))} disabled={busy}>{[90, 180, 270].map(value => <option key={value}>{value}°</option>)}</select></div>}</div>;
}

export function MediaSettings({ language, category, bitrate, sampleRate, resolution, fps, videoQuality, busy, onBitrate, onSampleRate, onResolution, onFps, onVideoQuality }: {
  language: Language; category: Category; bitrate: number; sampleRate: number; resolution: number; fps: number; videoQuality: string; busy: boolean;
  onBitrate: (value: number) => void; onSampleRate: (value: number) => void; onResolution: (value: number) => void; onFps: (value: number) => void; onVideoQuality: (value: string) => void;
}) {
  const t = copy[language];
  return <div className="settings-extra"><div className="setting-field"><label htmlFor="bitrate">{t.audioBitrate}</label><select id="bitrate" value={bitrate} onChange={event => onBitrate(Number(event.target.value))} disabled={busy}>{[96,128,192,256,320].map(value => <option key={value} value={value}>{value} kbps</option>)}</select></div>{category === "audio" && <div className="setting-field"><label htmlFor="sample-rate">{t.sampleRate}</label><select id="sample-rate" value={sampleRate} onChange={event => onSampleRate(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option><option value="44100">44100 Hz</option><option value="48000">48000 Hz</option></select></div>}{category === "video" && <><div className="setting-field"><label htmlFor="resolution">{t.resolution}</label><select id="resolution" value={resolution} onChange={event => onResolution(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option>{[2160,1440,1080,720,480].map(value => <option key={value} value={value}>{value}p</option>)}</select></div><div className="setting-field"><label htmlFor="fps">FPS</label><select id="fps" value={fps} onChange={event => onFps(Number(event.target.value))} disabled={busy}><option value="0">{t.original}</option>{[60,30,24].map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="setting-field"><label htmlFor="video-quality">{t.quality}</label><select id="video-quality" value={videoQuality} onChange={event => onVideoQuality(event.target.value)} disabled={busy}><option value="very_high">{t.veryHigh}</option><option value="high">{t.high}</option><option value="medium">{t.medium}</option><option value="low">{t.low}</option></select></div></>}</div>;
}
