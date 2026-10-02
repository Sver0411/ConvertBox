import type { ToolExecutionRequest, ToolResult } from './registry';
import { getTool } from './registry';
import { editImage } from './local-images';
import { hashFile } from './hash';
import { transformData, MAX_TEXT_BYTES } from './data';
import { createZip, extractZip, archiveDirectory, renamedFiles, MAX_ARCHIVE_BYTES } from './archive';
import { createServerJob, pollServerJob, ServerApiError } from '@/lib/server-api';
export async function executeTool(request: ToolExecutionRequest, signal: AbortSignal, progress: (value: number) => void): Promise<ToolResult> {
  const {toolId,files,settings} = request;
  const serverResults:{jobId:string;name:string;size:number}[]=[];
  const tool = getTool(toolId);
  if (!tool) throw new Error('Unknown tool');
  if (toolId.startsWith('data.')) {
    if (files[0]?.size > MAX_TEXT_BYTES) throw new Error('Text input exceeds 8 MB');
    const source = files.length ? new TextDecoder('utf-8',{fatal:true}).decode(await files[0].arrayBuffer()) : String(settings.text ?? '');
    return {kind:'text',text:transformData(toolId,source,String(settings.indent ?? '2')),name:`result.${toolId.endsWith('csv')?'csv':toolId.endsWith('yaml')?'yaml':'json'}`};
  }
  if (!files.length) throw new Error('Choose a file');
  if (toolId === 'file.hash') {
    const digest = await hashFile(files[0],String(settings.algorithm ?? 'sha256'),signal,progress);
    return {kind:'report',fields:[{label:String(settings.algorithm ?? 'SHA256'),value:digest},...(settings.expected ? [{label:'Checksum',value:String(settings.expected).trim().toLowerCase()===digest?'Match':'Mismatch'}]:[])]};
  }
  if (toolId === 'archive.zip-create' || toolId === 'file.rename') return {kind:'archive',blob:await createZip(toolId === 'file.rename'?renamedFiles(files,settings):files.map(file=>({name:file.name,blob:file}))),name:'files.zip'};
  if (toolId.startsWith('archive.') && toolId!=='archive.zip-create' && files[0].size>MAX_ARCHIVE_BYTES) throw new Error('Archive exceeds 64 MB');
  if (toolId === 'archive.inspect') {
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    const entries = archiveDirectory(bytes);
    return {kind:'report',fields:entries.map(entry=>({label:entry.name,value:String(entry.size)+' B'}))};
  }
  if (toolId === 'archive.zip-extract') return {kind:'files',files:extractZip(new Uint8Array(await files[0].arrayBuffer()))};
  const localImage = tool.processing !== 'server' && toolId.startsWith('image.') && files.every(file=>file.size<=25*1024*1024&&['image/jpeg','image/png','image/webp'].includes(file.type)) && !settings.keep_icc;
  if (localImage) {
    const results = [];
    for (let index=0;index<files.length;index++) { results.push({blob:await editImage(files[index],toolId,settings,signal),name:`${files[index].name.replace(/\.[^.]+$/,'')}.${settings.output ?? 'png'}`});progress((index+1)/files.length); }
    return results.length===1?{kind:'file',...results[0]}:{kind:'files',files:results};
  }
  if (tool.batchSupport && files.length>1) {
    const outputFiles:{blob:Blob;name:string}[]=[];
    // Server batches run serially; keep links instead of fetching results.
    for (let index=0;index<files.length;index++) {
      const result=await executeTool({...request,files:[files[index]]},signal,value=>progress((index+value)/files.length));
      if (result.kind==='server-file') { serverResults.push(result); } else if (result.kind==='file') outputFiles.push(result);
    }
    return serverResults.length?{kind:'server-files',files:serverResults}:{kind:'files',files:outputFiles};
  }
  if (tool.processing==='local') throw new Error('This tool only accepts supported local inputs');
  const clean = Object.fromEntries(Object.entries(settings).filter(([key,value])=>key!=='output'&&key!=='confirm_password'&&['string','number','boolean'].includes(typeof value))) as Record<string,string|number|boolean>;
  if (toolId==='pdf.protect' && settings.password!==settings.confirm_password) throw new Error('Passwords do not match');
  const output = String(settings.output ?? (toolId==='pdf.metadata'&&settings.remove?'pdf':tool.outputKind==='report'?'json':tool.outputKind==='archive'?'zip':toolId==='image.favicon'?'ico':tool.category==='pdf'?'pdf':toolId==='video.gif'?'gif':tool.category==='video'?'mp4':'png'));
  const job = await createServerJob(files,output,tool.operation,clean,signal,toolId);
  const completed = await pollServerJob(job.id,job=>progress(job.progress ?? 0),signal);
  if (completed.status!=='COMPLETED') throw new ServerApiError(completed.error ?? 'Processing failed',completed.errorCode??'CONVERSION_FAILED',400);
  if (output==='json') {
    const response = await fetch(`/api/jobs/${job.id}/download`,{signal});
    if (!response.ok || Number(response.headers.get('content-length'))>16*1024*1024) throw new Error('Report unavailable or too large');
    const data = await response.json() as Record<string,unknown>;
    return {kind:'report',fields:[...(toolId==='file.inspect'?[{label:'filename',value:files[0].name},{label:'extension',value:files[0].name.split('.').pop()??''}]:[]),...Object.entries(data).map(([label,value])=>({label,value:typeof value==='object'?JSON.stringify(value,null,2):String(value)}))]};
  }
  return {kind:'server-file',jobId:job.id,name:completed.outputName ?? 'result',size:completed.outputSize ?? 0};
}
