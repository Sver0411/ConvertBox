import {describe,it,expect} from 'vitest';
import {parseJson,transformData,jsonToCsv,csvToJson} from './data';
import {hashFile} from './hash';
import {archiveDirectory,extractZip,createZip,safeArchivePath,renamedFiles} from './archive';
describe('data tools',()=>{
 it('formats, minifies and validates semantic JSON',()=>{const text='{"a":[1,true]}';expect(JSON.parse(transformData('data.json-format',text))).toEqual(JSON.parse(text));expect(transformData('data.json-minify',text)).toBe(text);expect(transformData('data.json-validate',text)).toBe('JSON valid');expect(()=>parseJson('{\n"a": }')).toThrow(/JSON: 2:/);expect(()=>parseJson('{"a":1,}')).toThrow();});
 it('CSV quotes, newline, formula guard and nested rejection',()=>{expect(csvToJson('name,note\r\nA,"hello,\nworld"')).toEqual([{name:'A',note:'hello,\nworld'}]);expect(jsonToCsv([{v:'=SUM(A1)'}])).toContain("'=SUM");expect(()=>jsonToCsv([{x:{a:1}}])).toThrow(/Nested/);expect(()=>csvToJson('a,a\n1,2')).toThrow();expect(()=>csvToJson('a,b\n1')).toThrow();});
 it('converts YAML in both directions and rejects aliases',()=>{expect(JSON.parse(transformData('data.yaml-json','a: 1'))).toEqual({a:1});expect(transformData('data.json-yaml','{"a":1}')).toContain('a: 1');expect(()=>transformData('data.yaml-json','x: &x [1]\ny: *x')).toThrow();});
});
describe('hash',()=>{for(const [algorithm,expected] of [['sha256','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],['sha1','a9993e364706816aba3e25717850c26c9cd0d89d'],['md5','900150983cd24fb0d6963f7d28e17f72']])it(algorithm,async()=>expect(await hashFile(new Blob(['abc']),algorithm,new AbortController().signal)).toBe(expected));});
describe('ZIP and rename',()=>{
 it('roundtrips entries and contents',async()=>{const blob=await createZip([{name:'a.txt',blob:new Blob(['abc'])}]);const bytes=new Uint8Array(await blob.arrayBuffer());expect(archiveDirectory(bytes)[0].name).toBe('a.txt');expect(await extractZip(bytes)[0].blob.text()).toBe('abc');});
 it('rejects traversal and corrupted contents',async()=>{for(const name of ['../a','/a','C:/a','a\\b','a/../b'])expect(()=>safeArchivePath(name)).toThrow();const blob=await createZip([{name:'a',blob:new Blob(['abc'])}]);const bytes=new Uint8Array(await blob.arrayBuffer());bytes[31]^=1;expect(()=>extractZip(bytes)).toThrow();});
 it('renames without changing blobs',()=>{const file=new File(['abc'],'IMG_1.JPG');const result=renamedFiles([file,file],{mode:'sequence',prefix:'Trip_',start:1});expect(result.map(item=>item.name)).toEqual(['Trip_001.JPG','Trip_002.JPG']);expect(result[0].blob).toBe(file);expect(()=>renamedFiles([file],{mode:'replace',find:''})).toThrow();});
});
it('rejects ZIP expansion bombs and encryption before inflation',async()=>{
 const original=new Uint8Array(await (await createZip([{name:'a.txt',blob:new Blob(['abc'])}])).arrayBuffer());
 const offset=original.findIndex((_,index)=>original[index]===0x50&&original[index+1]===0x4b&&original[index+2]===1&&original[index+3]===2);
 const bomb=original.slice();new DataView(bomb.buffer).setUint32(offset+24,65*1024*1024,true);expect(()=>archiveDirectory(bomb)).toThrow();
 const encrypted=original.slice();new DataView(encrypted.buffer).setUint16(offset+8,1,true);expect(()=>archiveDirectory(encrypted)).toThrow();
 const many=original.slice();const end=many.length-22;new DataView(many.buffer).setUint16(end+10,1001,true);expect(()=>archiveDirectory(many)).toThrow();
 expect(()=>transformData('data.yaml-json','x: .nan')).toThrow(/Non-finite/);
});
it('preserves nested archive paths and resolves collisions in the same folder',async()=>{
 const blob=await createZip([{name:'a/note.txt',blob:new Blob(['A'])},{name:'b/note.txt',blob:new Blob(['B'])},{name:'a/note.txt',blob:new Blob(['C'])}],1,true);
 const extracted=extractZip(new Uint8Array(await blob.arrayBuffer()));expect(extracted.map(file=>file.name)).toEqual(['a/note.txt','b/note.txt','a/note_1.txt']);expect(await extracted[1].blob.text()).toBe('B');
});
it('supports CSV delimiter/header configuration and explicit nested flattening',()=>{
 expect(transformData('data.csv-json','A;2','2',{delimiter:';',header:false})).toContain('"column_2": "2"');
 expect(transformData('data.json-csv','[{"user":{"name":"A"},"age":2}]','2',{flatten:true,columns:'age,user.name'})).toBe('age,user.name\r\n2,A');
});
