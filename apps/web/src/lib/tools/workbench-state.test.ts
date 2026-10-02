import {expect,test} from 'vitest';
import {takeFiles,transferFiles} from './workbench-state';
test('handoff survives a replayed mount, then expires after that mount cycle',async()=>{
 const file=new File(['example'],'example.txt');transferFiles([file]);
 expect(takeFiles()).toEqual([file]);expect(takeFiles()).toEqual([file]);
 await Promise.resolve();expect(takeFiles()).toEqual([]);
});
test('a pending consumption cannot erase a newer handoff',async()=>{
 const first=new File(['one'],'one.txt'),second=new File(['two'],'two.txt');transferFiles([first]);takeFiles();transferFiles([second]);
 await Promise.resolve();expect(takeFiles()).toEqual([second]);await Promise.resolve();
});
