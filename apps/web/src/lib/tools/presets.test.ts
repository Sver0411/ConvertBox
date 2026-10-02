import {it,expect,vi} from 'vitest';
import {loadToolPresets,safeSettings,storeToolPreset} from './presets';
it('migrates legacy presets without deleting them and excludes secrets',()=>{
 const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)});
 memory.set('convertbox-presets-v2',JSON.stringify({version:2,presets:[{id:'custom',name:'Mine',category:'image',output:'jpg',quality:80,width:100,height:0,bitrate:192,resolution:0,videoQuality:'high',keepMetadata:false,custom:true}]}));
 const migrated=loadToolPresets();expect(migrated[0].toolId).toBe('image.convert');expect(migrated[0].settings.width).toBe(100);expect(memory.has('convertbox-presets-v2')).toBe(true);
 storeToolPreset('pdf.protect','Secret',{password:'secret',confirm_password:'secret'});expect(memory.get('convertbox-tool-presets-v3')).not.toContain('secret');expect(safeSettings({text:'private',password:'abc',quality:80})).toEqual({quality:80});vi.unstubAllGlobals();
});
