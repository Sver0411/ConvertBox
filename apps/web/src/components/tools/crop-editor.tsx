'use client';
import {useState} from 'react';
import Cropper from 'react-easy-crop';
import {useBlobUrl} from './preview';
export default function CropEditor({file,onChange,language}: {file:File;onChange:(settings:Record<string,unknown>)=>void;language:'zh'|'en'}) {
  const url=useBlobUrl(file), [crop,setCrop]=useState({x:0,y:0}),[zoom,setZoom]=useState(1),[aspect,setAspect]=useState('free'),[rotation,setRotation]=useState(0);
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return <p role="alert">{language==='zh'?'裁剪支持 JPG、PNG、WebP 静态图片':'Crop accepts static JPG, PNG and WebP images'}</p>;
  return <section><div className="crop-surface"><Cropper image={url} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect==='free'?undefined:Number(aspect)} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_,area)=>onChange({crop_x:area.x,crop_y:area.y,crop_width:area.width,crop_height:area.height,rotation})}/></div><div className="tool-settings"><label>{language==='zh'?'比例':'Aspect ratio'}<select value={aspect} onChange={event=>setAspect(event.target.value)}>{[['free','自由'],['1','1:1'],[String(4/3),'4:3'],['1.5','3:2'],[String(16/9),'16:9'],[String(9/16),'9:16']].map(([value,label])=><option key={value} value={value}>{value==='free'&&language==='en'?'Free':label}</option>)}</select></label><label>{language==='zh'?'缩放':'Zoom'}<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label><button onClick={()=>setRotation(value=>(value+90)%360)}>{language==='zh'?'向右旋转':'Rotate right'}</button></div></section>;
}
