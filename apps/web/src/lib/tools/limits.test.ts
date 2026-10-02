import {it,expect} from 'vitest';
import {getTool} from './registry';
import {validateToolInputs} from './limits';
it('admits bounded batches and rejects oversized or incompatible selections',()=>{
 expect(()=>validateToolInputs(getTool('image.compress')!,Array.from({length:101},()=>({size:1})))).toThrow(/100 files/);
 expect(()=>validateToolInputs(getTool('image.compress')!,[{size:40*1024*1024},{size:30*1024*1024}])).toThrow(/64 MB/);
 expect(()=>validateToolInputs(getTool('file.hash')!,[{size:1},{size:1}])).not.toThrow();
 expect(()=>validateToolInputs(getTool('file.hash')!,[{size:1},{size:1},{size:1}])).toThrow(/2 files/);
 expect(()=>validateToolInputs(getTool('archive.zip-create')!,Array.from({length:1000},()=>({size:1})))).not.toThrow();
 expect(()=>validateToolInputs(getTool('file.hash')!,[{size:10*1024**3}])).not.toThrow();
});
