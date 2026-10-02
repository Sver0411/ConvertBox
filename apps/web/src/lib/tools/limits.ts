import type {ToolDefinition} from './registry';
export const MAX_LOCAL_BATCH_BYTES=64*1024*1024;
export function validateToolInputs(tool:ToolDefinition,files:readonly Pick<File,'size'>[]):void {
 const maximum=tool.id==='file.hash'?2:tool.id==='archive.zip-create'||tool.id==='file.rename'?1000:100;
 if(files.length>maximum)throw new Error(`Tool accepts at most ${maximum} files`);
 if(files.length>1&&!tool.batchSupport&&!tool.multipleInputSupport)throw new Error('This tool accepts one file');
 if(tool.category==='image'&&files.length>1&&files.reduce((sum,file)=>sum+file.size,0)>MAX_LOCAL_BATCH_BYTES)throw new Error('Image batches exceed 64 MB. Use smaller batches.');
}
