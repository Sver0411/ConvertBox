import {loadCustomPresets} from '../presets';
import {getTool,type ToolDefinition} from './registry';
export interface ToolPreset {version:3;id:string;name:string;toolId:ToolDefinition['id'];settings:Record<string,string|number|boolean>}
const KEY='convertbox-tool-presets-v3';
export function safeSettings(settings:Record<string,unknown>):Record<string,string|number|boolean> {
 return Object.fromEntries(Object.entries(settings).filter(([key,value])=>!['password','confirm_password','text','expected','media_duration','pdf_page_count'].includes(key)&&['string','number','boolean'].includes(typeof value)&& (typeof value!=='string'||value.length<4096))) as Record<string,string|number|boolean>;
}
export function loadToolPresets():ToolPreset[] {
 try {const saved:unknown=JSON.parse(localStorage.getItem(KEY)??'null');if(Array.isArray(saved))return saved.filter((item):item is ToolPreset=>!!item&&item.version===3&&typeof item.id==='string'&&typeof item.name==='string'&&!!getTool(item.toolId)&&!!item.settings).map(item=>({...item,settings:safeSettings(item.settings)})).slice(0,50);
 const migrated:ToolPreset[]=loadCustomPresets().map(item=>({version:3,id:item.id,name:item.name,toolId:`${item.category}.convert`,settings:{output:item.output,quality:item.quality,width:item.width,height:item.height,bitrate:item.bitrate,resolution:item.resolution,video_quality:item.videoQuality,keep_metadata:item.keepMetadata}}));localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;
 }catch{return [];}
}
export function storeToolPreset(toolId:ToolDefinition['id'],name:string,settings:Record<string,unknown>):ToolPreset[] {const presets=[...loadToolPresets(),{version:3 as const,id:crypto.randomUUID(),toolId,name:name.trim().slice(0,50),settings:safeSettings(settings)}].slice(-50);localStorage.setItem(KEY,JSON.stringify(presets));return presets;}
