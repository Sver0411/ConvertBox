import {createServerJob,pollServerJob,deleteServerJob} from '@/lib/server-api';
export async function previewJob(file:File,toolId:string,output:string,settings:Record<string,string|number|boolean>,signal:AbortSignal){
 const job=await createServerJob([file],output,toolId,settings,signal,toolId);
 try{const done=await pollServerJob(job.id,()=>{},signal);if(done.status!=='COMPLETED')throw new Error(done.error??'Preview failed');return {id:job.id,size:done.outputSize??0,url:`/api/jobs/${job.id}/download?preview=true`};}catch(error){void deleteServerJob(job.id).catch(()=>{});throw error;}
}
export async function previewReport<T>(file:File,id:string,settings:Record<string,string|number|boolean>,signal:AbortSignal):Promise<T>{
 const job=await previewJob(file,id,'json',settings,signal);
 try{const response=await fetch(job.url,{signal});if(!response.ok||Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('Preview unavailable');return await response.json() as T;}finally{void deleteServerJob(job.id).catch(()=>{});}
}
