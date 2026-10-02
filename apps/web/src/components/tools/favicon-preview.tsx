/* eslint-disable @next/next/no-img-element */
'use client';
import {useBlobUrl} from './preview';
export default function FaviconPreview({file,fit,language}:{file:File;fit:unknown;language:'zh'|'en'}){const url=useBlobUrl(file);return <section><p>{language==='zh'?'图标尺寸预览':'Icon size preview'}</p><div className="favicon-sizes">{[16,32,48,64].map(size=><figure key={size}><img src={url} alt={`${size} px`} style={{width:size,height:size,objectFit:fit==='crop'?'cover':'contain'}}/><figcaption>{size} px</figcaption></figure>)}</div><div className="favicon-tab"><img src={url} alt="" style={{objectFit:fit==='crop'?'cover':'contain'}}/>{language==='zh'?'浏览器标签页':'Browser tab'}</div></section>;}
