import type {ToolResult} from './registry';
export interface Draft {files:File[];settings:Record<string,unknown>;result:ToolResult|null;snapshot:string;resultInputs:File[]}
const drafts=new Map<string,Draft>();
export function storeDraft(id:string,value:Draft){
 drafts.delete(id);drafts.set(id,{...value,settings:Object.fromEntries(Object.entries(value.settings).filter(([key])=>!['password','confirm_password'].includes(key)))});
 while(drafts.size>3)drafts.delete(drafts.keys().next().value!);
 let retained=0;for(const [key,item] of [...drafts].reverse()){
  const blobs=new Set<Blob>([...item.files,...item.resultInputs]);const result=item.result;
  if(result?.kind==='file'||result?.kind==='archive')blobs.add(result.blob);
  if(result?.kind==='files')result.files.forEach(file=>blobs.add(file.blob));
  if(result?.kind==='batch')result.items.forEach(file=>{if(file.kind==='file')blobs.add(file.blob);});
  const cost=[...blobs].reduce((n,blob)=>n+blob.size,0)+JSON.stringify(item.settings).length*2+(result?.kind==='text'?result.text.length*2:0);
  if(retained+cost>64*1024*1024)drafts.delete(key);else retained+=cost;
 }
}
export function readDraft(id:string){return drafts.get(id);}
let handoff:File[]=[];
export function transferFiles(files:File[]){handoff=files;}
// Development Strict Mode replays mount effects before this microtask runs.
export function takeFiles(){const next=handoff;queueMicrotask(()=>{if(handoff===next)handoff=[];});return next;}
export interface SavedTask {id:string;toolId:string;name:string;settings:Record<string,string|number|boolean>;createdAt:number}
export function tasks():SavedTask[]{try{const value=JSON.parse(localStorage.getItem('convertbox-tasks')??'[]');return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'&&typeof item.toolId==='string'&&typeof item.name==='string'&&typeof item.createdAt==='number'&&item.settings&&typeof item.settings==='object').slice(0,50):[]}catch{return []}}
export function rememberTask(task:SavedTask){try{localStorage.setItem('convertbox-tasks',JSON.stringify([task,...tasks().filter(item=>item.id!==task.id)].slice(0,50)))}catch{}}
export function forgetTask(id:string){try{localStorage.setItem('convertbox-tasks',JSON.stringify(tasks().filter(task=>task.id!==id)))}catch{}}
function textFingerprint(text:string){let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return `${text.length}:${hash>>>0}`;}
export function inputSnapshot(files:File[],settings:Record<string,unknown>){return JSON.stringify([files.map(file=>[file.name,file.size,file.lastModified]),Object.fromEntries(Object.entries(settings).filter(([key])=>!['password','confirm_password','media_duration','pdf_page_count'].includes(key)).map(([key,value])=>[key,key==='text'?textFingerprint(String(value??'')):value]))]);}
