import type { ToolDefinition, ToolSettingDefinition, ToolCategory } from './registry';
const l = (zh: string, en: string) => ({ zh, en });
export const select = (key: string, zh: string, en: string, values: string[], value = values[0]): ToolSettingDefinition => ({ key, label: l(zh,en), kind:'select', defaultValue:value, options:values.map(value => ({value,label:l(value,value)})) });
export const number = (key: string, zh: string, en: string, value: number, min: number, max: number): ToolSettingDefinition => ({ key,label:l(zh,en),kind:'number',defaultValue:value,min,max });
export const text = (key: string, zh: string, en: string, value = ''): ToolSettingDefinition => ({key,label:l(zh,en),kind:'text',defaultValue:value});
const output = select('output','输出格式','Output format',['png','jpg','webp']);
const quality = number('quality','质量','Quality',85,1,100);
export function tool(id: ToolDefinition['id'], zh: string, en: string, processing: ToolDefinition['processing'], outputKind: ToolDefinition['outputKind'], settingsSchema: ToolSettingDefinition[] = [], multiple = false): ToolDefinition {
  const category = id.split('.')[0] as ToolCategory;
  return {id,category,name:l(zh,en),description:l('',''),icon:category,acceptedInputs:category==='image'?['image/*']:category==='pdf'?['application/pdf']:category==='audio'?['audio/*']:category==='video'?['video/*']:['*'],processing,outputKind,settingsSchema,operation:id,batchSupport:category==='image'&&id!=='image.crop',multipleInputSupport:multiple,estimatedResourceClass:['video','pdf'].includes(category)?'heavy':'medium'};
}
const pages=text('pages','页码（all 或 1,3-5）','Pages (all or 1,3-5)','all');
export const expandedTools: ToolDefinition[] = [
  tool('image.compress','压缩图片','Compress images','hybrid','file',[output,quality]),
  tool('image.crop','裁剪图片','Crop image','local','file',[output,quality]),
  tool('image.rotate','旋转图片','Rotate images','hybrid','file',[output,select('rotation','角度（顺时针）','Clockwise rotation',['90','180','270','0']),quality]),
  tool('image.flip','翻转图片','Flip images','hybrid','file',[output,{...select('direction','方向','Direction',['horizontal','vertical']),options:[{value:'horizontal',label:l('水平','Horizontal')},{value:'vertical',label:l('垂直','Vertical')}]}]),
  tool('image.metadata','图片元数据','Image metadata','server','report'),
  tool('image.strip-metadata','移除图片元数据','Remove image metadata','hybrid','file',[output,quality,{key:'keep_icc',label:l('保留色彩配置','Keep color profile'),kind:'boolean',defaultValue:false}]),
  tool('image.favicon','生成网站图标','Create favicon','server','file'),
  tool('pdf.organize','整理 PDF 页面','Organize PDF pages','server','file'),
  tool('pdf.extract-pages','提取 PDF 页面','Extract PDF pages','server','file',[pages]),
  tool('pdf.delete-pages','删除 PDF 页面','Delete PDF pages','server','file',[pages]),
  tool('pdf.watermark','PDF 文字水印','PDF text watermark','server','file',[text('text','水印文字','Watermark text'),number('font_size','字号','Font size',36,8,120),number('opacity','不透明度（0–1）','Opacity (0–1)',.2,.01,1),number('rotation','角度','Rotation',45,-180,180),select('position','位置','Position',['center','top-left','top-right','bottom-left','bottom-right']),pages]),
  tool('pdf.page-numbers','添加 PDF 页码','Add PDF page numbers','server','file',[number('start','起始页码','Start number',1,0,100000),select('position','位置','Position',['bottom-center','bottom-left','bottom-right','top-center']),number('font_size','字号','Font size',12,6,72),number('margin','边距','Margin',24,0,100),select('format','格式','Format',['{n} / {total}','Page {n}','{n}']),pages]),
  tool('pdf.extract-images','提取 PDF 内嵌图片','Extract embedded PDF images','server','archive'),
  tool('pdf.metadata','PDF 元数据','PDF metadata','server','report',[{key:'remove',label:l('移除元数据并导出 PDF','Remove metadata and export PDF'),kind:'boolean',defaultValue:false}]),
  tool('pdf.protect','PDF 密码保护','Password protect PDF','server','file',[text('password','密码','Password'),text('confirm_password','确认密码','Confirm password')]),
];
