import {validateToolInputs,MAX_LOCAL_BATCH_BYTES} from './limits';
import type {ToolExecutionRequest,ToolResult} from './registry';
import {getTool} from './registry';
import {editImage} from './local-images';
import {hashFile} from './hash';
import {transformData,MAX_TEXT_BYTES} from './data';
import {createZip,extractZip,archiveDirectory,renamedFiles,MAX_ARCHIVE_BYTES} from './archive';
import {createServerJob,pollServerJob,ServerApiError,type ServerJob} from '@/lib/server-api';
import {detectFileType} from '@detection/detect';
import {LocalImageScheduler,estimatedImageBytes,DEFAULT_LOCAL_MEMORY_BUDGET} from '@/lib/local-scheduler';
import {convertImage,browserCanEncode} from '@/lib/image-converter';
import type {ImageFormat} from '@shared/index';
import {safeSettings} from './presets';
import {rememberTask} from './workbench-state';
const scheduler=new LocalImageScheduler(DEFAULT_LOCAL_MEMORY_BUDGET,1);
export interface ExecutionEvents {stage?:(value:string)=>void;job?:(job:ServerJob)=>void;finished?:(id:string)=>void;item?:(index:number,result:ToolResult|undefined,error?:string)=>void}
export async function executeTool(request:ToolExecutionRequest,signal:AbortSignal,progress:(value:number)=>void,events:ExecutionEvents={}):Promise<ToolResult>{
 const {toolId,files,settings}=request,tool=getTool(toolId);if(!tool)throw new Error('Unknown tool');validateToolInputs(tool,files);
 if(toolId.startsWith('data.')){
  const text=String(settings.text??'');if(new TextEncoder().encode(text).byteLength>MAX_TEXT_BYTES)throw new Error('Text input exceeds 8 MB');
  return {kind:'text',text:transformData(toolId,text,String(settings.indent??'2'),{delimiter:String(settings.delimiter??','),header:settings.header!==false,flatten:settings.flatten===true,columns:String(settings.columns??'')}),name:toolId==='data.json-validate'?'validation.txt':`result.${toolId.endsWith('csv')?'csv':toolId.endsWith('yaml')?'yaml':'json'}`};
 }
 if(!files.length)throw new Error('Choose a file');
 if(toolId==='file.hash'){
  const values=[];for(let i=0;i<files.length;i++){values.push(await hashFile(files[i],String(settings.algorithm??'sha256'),signal,p=>progress((i+p)/files.length)));}
  return {kind:'report',fields:[...values.map((value,index)=>({label:files[index].name,value})),...(files.length===2?[{label:'Checksum',value:values[0]===values[1]?'Match':'Mismatch'}]:settings.expected?[{label:'Checksum',value:String(settings.expected).replace(/\s/g,'').toLowerCase()===values[0]?'Match':'Mismatch'}]:[])]};
 }
 if(toolId==='archive.zip-create'||toolId==='file.rename')return {kind:'archive',blob:await createZip(toolId==='file.rename'?renamedFiles(files,settings):files.map(file=>({name:file.webkitRelativePath||file.name,blob:file})),Number(settings.compression??1),settings.preserve_paths!==false,signal),name:'files.zip'};
 if(toolId.startsWith('archive.')&&files[0].size>MAX_ARCHIVE_BYTES)throw new Error('Archive exceeds 64 MB');
 if(toolId==='archive.inspect')return {kind:'report',fields:archiveDirectory(new Uint8Array(await files[0].arrayBuffer())).map(entry=>({label:entry.name,value:entry.size+' B'}))};
 if(toolId==='archive.zip-extract')return {kind:'files',files:extractZip(new Uint8Array(await files[0].arrayBuffer()))};
 if(tool.batchSupport&&files.length>1&&!(toolId==='image.convert'&&settings.output==='pdf'&&settings.combine_pages!==false)){
  const outputFiles:{blob:Blob;name:string}[]=[],serverFiles:{jobId:string;name:string;size:number}[]=[],failures:{name:string;error:string}[]=[];let retained=0;
  for(let i=0;i<files.length;i++){
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   try{const value=await executeTool({...request,files:[files[i]]},signal,p=>progress((i+p)/files.length),events);
    if(value.kind==='server-file')serverFiles.push(value);else if(value.kind==='file'){retained+=value.blob.size;if(retained>MAX_LOCAL_BATCH_BYTES)throw new Error('Image batch results exceed 64 MB');outputFiles.push(value);}
    events.item?.(i,value);
   }catch(error){if(signal.aborted)throw error;const message=error instanceof Error?error.message:String(error);failures.push({name:files[i].name,error:message});events.item?.(i,undefined,message);}
  }
  // Keep both local and server items; mixed formats must not drop local successes.
  return {kind:'batch',items:[...outputFiles.map(file=>({kind:'file' as const,...file})),...serverFiles.map(file=>({kind:'server-file' as const,...file}))],failures};
 }
 let output=String(settings.output??(toolId==='pdf.metadata'&&settings.remove?'pdf':tool.outputKind==='report'?'json':tool.outputKind==='archive'?'zip':toolId==='image.favicon'?'ico':tool.category==='pdf'?'pdf':toolId==='video.gif'?'gif':tool.category==='video'?'mp4':'png'));
 const descriptor=await detectFileType(files[0]);if(descriptor.error&&toolId!=='file.inspect')throw new Error(descriptor.error);
 if(output==='preserve')output=['jpg','png','webp'].includes(descriptor.detectedType)?descriptor.detectedType:'png';
 if(tool.workspace&&tool.category==='pdf'&&tool.operation!=='convert')output='pdf';
 const resolved:Record<string,unknown>={...settings,output};
 if(toolId==='image.resize'){
  const width=Number(settings.width??0),height=Number(settings.height??0),percent=Number(settings.percent??100);
  if(!width&&!height){resolved.width=Math.round((descriptor.width??0)*percent/100);resolved.height=Math.round((descriptor.height??0)*percent/100);}
  else if(settings.lock_ratio===false&&width&&height)resolved.stretch=true;
  else if(settings.lock_ratio!==false){if(width)resolved.height=0;else resolved.width=0;}
 }
 const cost=estimatedImageBytes(descriptor,{output:output as ImageFormat,quality:Number(settings.quality??85),width:Number(resolved.width??0),height:Number(resolved.height??0)});
 const localImage=cost<=DEFAULT_LOCAL_MEMORY_BUDGET&&browserCanEncode(output as ImageFormat)&&!resolved.stretch&&tool.processing!=='server'&&tool.category==='image'&&files[0].size<=25*1024*1024&&['jpg','png','webp'].includes(descriptor.detectedType)&&['jpg','png','webp'].includes(output)&&!settings.keep_icc&&!settings.keep_metadata;
 if(localImage){
  events.stage?.('local');
  const blob=tool.workspace?await scheduler.run(cost,signal,()=>convertImage(files[0],{output:output as ImageFormat,quality:Number(settings.quality??85),width:Number(resolved.width??0),height:Number(resolved.height??0),background:String(settings.background??"#ffffff")},()=>{},signal)):await editImage(files[0],toolId,resolved,signal);
  let final=blob;
  if(toolId==='image.compress'&&Number(settings.target_kb)>0){for(let quality=Number(settings.quality??85)-10;quality>=10&&final.size>Number(settings.target_kb)*1024;quality-=10){if(signal.aborted)throw new DOMException('Cancelled','AbortError');final=await editImage(files[0],toolId,{...resolved,quality},signal);}}
  return {kind:'file',blob:final,name:`${files[0].name.replace(/\.[^.]+$/,'')}.${output}`};
 }
 if(tool.processing==='local')throw new Error('This tool only accepts supported local inputs');
 const clean=Object.fromEntries(Object.entries(resolved).filter(([key,value])=>!['output','confirm_password','text_source','percent','lock_ratio','compare'].includes(key)&&['string','number','boolean'].includes(typeof value))) as Record<string,string|number|boolean>;
 if(toolId==='pdf.protect'&&settings.password!==settings.confirm_password)throw new Error('Passwords do not match');
 if(toolId==='document.convert'&&descriptor.detectedType==='pdf')output='docx';
 events.stage?.('uploading');
 const job=await createServerJob(files,output,tool.operation==='resize'?'convert':tool.operation,clean,signal,tool.workspace?undefined:toolId,()=>events.stage?.('rate-wait'));
 events.job?.(job);rememberTask({id:job.id,toolId,name:files.map(file=>file.name).join(', '),settings:safeSettings(resolved),createdAt:Date.now()});
 const completed=await pollServerJob(job.id,value=>{events.stage?.(value.status.toLowerCase());progress(value.progress??0);},signal);
 events.finished?.(job.id);
 if(completed.status!=='COMPLETED')throw new ServerApiError(completed.error??'Processing failed',completed.errorCode??'CONVERSION_FAILED',400);
 if(output==='json'){
  const response=await fetch(`/api/jobs/${job.id}/download`,{signal});if(!response.ok||Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('Report unavailable or too large');
  const data=await response.json() as Record<string,unknown>;
  if(toolId==='file.inspect'){const extension=files[0].name.split('.').pop()?.toLowerCase()??'';data.filename=files[0].name;data.extension=extension;data.extension_matches=data.actual_format==='unknown'?'Unknown':extension===data.actual_format||extension==='jpeg'&&data.actual_format==='jpg'?'Match':'Mismatch';}
  return {kind:'report',fields:Object.entries(data).map(([label,value])=>({label,value:typeof value==='object'?JSON.stringify(value,null,2):String(value)}))};
 }
 return {kind:'server-file',jobId:job.id,name:completed.outputName??'result',size:completed.outputSize??0};
}
