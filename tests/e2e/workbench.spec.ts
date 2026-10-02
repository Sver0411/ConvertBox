import { expect, test } from "@playwright/test";

test("tool search, favorite, stable URL and search context persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "选择工具" })).toBeVisible();
  await page.getByLabel("搜索工具", { exact: true }).fill("图片");
  await page.getByRole("button", { name: "收藏 图片格式转换", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消收藏 图片格式转换", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /图片格式转换/ }).click();
  await expect(page).toHaveURL(/\/tools\/image\/convert$/);
  await expect(page.getByLabel("选择文件")).toBeAttached();
  await page.getByRole("link", { name: "工具中心" }).click();
  await expect(page.getByLabel("搜索工具", { exact: true })).toHaveValue("图片");
  await page.getByRole("button", {name:"收藏",exact:true}).click();
  await expect(page.getByRole("link",{name:/图片格式转换/})).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "搜索工具" })).toBeVisible();
  await page.getByRole("dialog").getByLabel("搜索工具").fill("resize");
  await page.getByRole("dialog").getByRole("button", { name: /调整图片尺寸/ }).click();
  await expect(page).toHaveURL(/\/tools\/image\/resize$/);
});

import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {zipSync} from 'fflate';
const inputFile=(name:string,mimeType:string)=>({name,mimeType,buffer:readFileSync(resolve(__dirname,'../fixtures',name))});
for (const [route,name,file] of [
 ['image/compress','压缩图片',inputFile('sample.png','image/png')],
 ['image/crop','裁剪图片',inputFile('sample.png','image/png')],
 ['image/metadata','图片元数据',inputFile('sample.png','image/png')],
 ['pdf/extract-images','提取 PDF 内嵌图片',inputFile('embedded.pdf','application/pdf')],
 ['pdf/organize','整理 PDF 页面',inputFile('sample.pdf','application/pdf')],
 ['pdf/watermark','PDF 文字水印',inputFile('sample.pdf','application/pdf')],
 ['pdf/page-numbers','添加 PDF 页码',inputFile('sample.pdf','application/pdf')],
 ['audio/trim','裁剪音频',inputFile('sample.wav','audio/wav')],
 ['video/compress','压缩视频',inputFile('sample.mp4','video/mp4')],
 ['video/gif','视频转 GIF',inputFile('sample.mp4','video/mp4')],
 ['file/inspect','检查文件',inputFile('sample.png','image/png')],
 ['file/hash','文件校验值',{name:'abc.txt',mimeType:'text/plain',buffer:Buffer.from('abc')}],
 ['archive/zip-create','创建 ZIP',{name:'abc.txt',mimeType:'text/plain',buffer:Buffer.from('abc')}],
 ['archive/zip-extract','解压 ZIP',{name:'sample.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'abc.txt':Buffer.from('abc')}))}],
] as const) test(`workbench ${route}`,async({page})=>{
 await page.goto(`/tools/${route}`);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await page.getByLabel('选择文件',{exact:true}).setInputFiles(file);
 if(route==='pdf/organize')await expect(page.locator('.pdf-page-grid img')).toHaveCount(1);
 if(route==='pdf/watermark')await page.getByLabel('水印文字',{exact:true}).fill('CONFIDENTIAL');
 if(route==='audio/trim')await page.getByLabel('结束时间',{exact:true}).fill('00:00:00.5');
 if(route==='video/gif')await page.getByLabel('时长（秒，最多 15）',{exact:true}).fill('1');
 if(route==='image/crop'){await expect(page.locator('.crop-surface img')).toBeVisible();await expect(page.getByRole('button',{name:'调整裁剪框大小'})).toBeVisible();}
 await page.getByRole('button',{name:/^(处理并导出|计算校验值|处理文本|重命名并打包|检查目录|提取文件)$/}).click();await expect(page.locator('.tool-result')).toBeVisible({timeout:60000});await expect(page.locator('.tool-page').getByRole('alert')).toHaveCount(0);
 if(route==='file/hash')await expect(page.locator('.tool-result')).toContainText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 if(route==='image/metadata')await expect(page.locator('.tool-result')).toContainText('宽度');
 await page.getByLabel('主题',{exact:true}).selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');if(route==='image/crop'){await expect(page.getByRole('button',{name:'替换文件'})).toHaveCSS('background-color','rgb(32, 45, 61)');await page.screenshot({path:'../../docs/screenshots/workbench-crop.png'});}
});
for(const [route,input,result] of [['json-format','{"a":1}','"a": 1'],['csv-json','name,age\nA,20','"name": "A"']] as const)test(`data ${route}`,async({page})=>{await page.goto(`/tools/data/${route}`);await page.getByLabel('输入文本',{exact:true}).fill(input);await page.getByRole('button',{name:'处理文本'}).click();await expect(page.locator('.tool-result')).toContainText(result);});

test('visual crop exports square pixels and free resize handle responds',async({page})=>{
 await page.goto('/tools/image/crop');
 const bytes=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='red';ctx.fillRect(0,0,48,64);ctx.fillStyle='blue';ctx.fillRect(48,0,48,64);return canvas.toDataURL('image/png').split(',')[1];});
 await page.getByLabel('选择文件',{exact:true}).setInputFiles({name:'crop.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
 const handle=page.getByRole('button',{name:'调整裁剪框大小'});await expect(handle).toBeVisible();await handle.scrollIntoViewIfNeeded();const before=await handle.boundingBox();await page.mouse.move(before!.x+10,before!.y+10);await page.mouse.down();await page.mouse.move(before!.x+30,before!.y+25);await page.mouse.up();await expect.poll(async()=> (await handle.boundingBox())!.x).toBeGreaterThan(before!.x);
 await page.getByLabel('比例',{exact:true}).selectOption('1');
 await page.getByRole('button',{name:/^(处理并导出|计算校验值|处理文本|重命名并打包|检查目录|提取文件)$/}).click();await expect(page.locator('.tool-result')).toBeVisible();
 await page.locator('.result-preview').evaluate((image:HTMLImageElement)=>image.decode());const dimensions=await page.locator('.result-preview').evaluate((image:HTMLImageElement)=>[image.naturalWidth,image.naturalHeight]);expect(dimensions[0]).toBe(dimensions[1]);expect(dimensions[0]).toBeGreaterThan(0);
});

test('PDF organizer exports chosen order, rotation and deletion',async({page})=>{
 await page.goto('/tools/pdf/organize');await page.getByLabel('选择文件',{exact:true}).setInputFiles(inputFile('pages.pdf','application/pdf'));await expect(page.locator('.pdf-page-grid img')).toHaveCount(3);
 await page.getByRole('button',{name:'取消选择',exact:true}).click();await page.getByLabel('原页面 3',{exact:true}).check();await page.getByRole('button',{name:'旋转所选',exact:true}).click();
 const third=page.locator('.pdf-page-grid>div').filter({has:page.getByText('原页面 3',{exact:true})});await third.getByRole('button',{name:'前移页面'}).click();await third.getByRole('button',{name:'前移页面'}).click();
 await page.getByLabel('原页面 3',{exact:true}).uncheck();await page.getByLabel('原页面 2',{exact:true}).check();await page.getByRole('button',{name:'删除所选',exact:true}).click();await expect(page.locator('.pdf-page-grid img')).toHaveCount(2);
 await page.getByRole('button',{name:/^(处理并导出|计算校验值|处理文本|重命名并打包|检查目录|提取文件)$/}).click();await expect(page.locator('.tool-result')).toBeVisible();
 const pending=page.waitForEvent('download');await page.locator('.tool-result').getByRole('button',{name:/下载/}).click();const download=await pending;const file=await download.path();
 const {execFileSync}=await import('node:child_process');const report=execFileSync('uv',['run','python','-c','import pymupdf,json,sys; d=pymupdf.open(sys.argv[1]); print(json.dumps({"text":[p.get_text() for p in d],"rotation":[p.rotation for p in d]}))',file],{cwd:resolve(__dirname,'../../apps/api'),encoding:'utf8'});const data=JSON.parse(report);expect(data.text).toHaveLength(2);expect(data.text[0]).toContain('Original page 3');expect(data.text[1]).toContain('Original page 1');expect(data.rotation).toEqual([90,0]);
});
