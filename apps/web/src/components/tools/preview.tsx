'use client';
import {useEffect,useState} from 'react';
export function useBlobUrl(blob: Blob | undefined) {
  const [url,setUrl] = useState('');
  useEffect(()=>{ if (!blob) {setUrl('');return;} const next=URL.createObjectURL(blob);setUrl(next);return()=>URL.revokeObjectURL(next); },[blob]);
  return url;
}
export function Preview({blob,alt}: {blob: Blob;alt:string}) {
  const url=useBlobUrl(blob);
  if (!url) return null;
  // SVG is never embedded in the preview surface.
  // eslint-disable-next-line @next/next/no-img-element
  if (['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon'].includes(blob.type)) return <img className="result-preview" src={url} alt={alt}/>;
  if(blob.type==='application/pdf')return <iframe className="result-document" src={url} title={alt}/>;
  if (blob.type.startsWith('audio/')) return <audio controls src={url}/>;
  if (blob.type.startsWith('video/')) return <video controls src={url}/>;
  return null;
}
