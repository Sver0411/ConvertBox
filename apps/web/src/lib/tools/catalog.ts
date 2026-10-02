import type { ToolDefinition, ToolSettingDefinition, ToolCategory } from './registry';
const labels:Record<string,string>={horizontal:'水平',vertical:'垂直',center:'居中','top-left':'左上','top-right':'右上','bottom-left':'左下','bottom-right':'右下','bottom-center':'底部居中','top-center':'顶部居中',general:'通用',podcast:'播客',music:'音乐',light:'轻度',balanced:'均衡',strong:'强力',high:'高',even:'均匀抽取',interval:'按间隔',single:'指定时间',prefix:'前缀与后缀',sequence:'序号',replace:'查找替换',lowercase:'小写',uppercase:'大写',date:'日期',pad:'居中留白',crop:'填满裁剪',preserve:'保留原格式',auto:'自动',mono:'单声道',stereo:'立体声',tab:'制表符','2':'2 个空格','4':'4 个空格',eng:'英文',chi_sim:'简体中文','chi_sim+eng':'中英混合',portrait:'纵向',landscape:'横向',none:'无',small:'小',medium:'中',large:'大',very_high:'很高'};
const l = (zh: string, en: string) => ({ zh, en });
export const select = (key: string, zh: string, en: string, values: string[], value = values[0]): ToolSettingDefinition => ({ key, label: l(zh,en), kind:'select', defaultValue:value, options:values.map(value => ({value,label:l(labels[value]??value,({preserve:'Keep source format',pad:'Center with padding',crop:'Fill and crop',very_high:'Very high',chi_sim:'Simplified Chinese',eng:'English','chi_sim+eng':'Chinese and English',even:'Evenly spaced',single:'Specific time',interval:'At intervals',sequence:'Sequence',prefix:'Prefix and suffix',replace:'Find and replace',date:'Date',auto:'Automatic'} as Record<string,string>)[value]??value)})) });
export const number = (key: string, zh: string, en: string, value: number, min: number, max: number): ToolSettingDefinition => ({ key,label:l(zh,en),kind:'number',defaultValue:value,min,max });
export const text = (key: string, zh: string, en: string, value = ''): ToolSettingDefinition => ({key,label:l(zh,en),kind:'text',defaultValue:value});
const output = select('output','输出格式','Output format',['png','jpg','webp']);
export const quality = number('quality','质量','Quality',85,1,100);
export function tool(id: ToolDefinition['id'], zh: string, en: string, processing: ToolDefinition['processing'], outputKind: ToolDefinition['outputKind'], settingsSchema: ToolSettingDefinition[] = [], multiple = false): ToolDefinition {
  const category = id.split('.')[0] as ToolCategory;
  return {id,category,name:l(zh,en),description:l('',''),icon:category,acceptedInputs:id==='image.crop'?['image/jpeg','image/png','image/webp']:category==='image'?['image/*']:category==='pdf'?['application/pdf']:category==='audio'?['audio/*']:category==='video'?['video/*']:['*'],processing,outputKind,settingsSchema,operation:id,batchSupport:category==='image'&&id!=='image.crop'&&outputKind!=='report',multipleInputSupport:multiple,keywords:category==='image'?['jpg','jpeg','png','webp','image']:category==='pdf'?['pdf']:[],estimatedResourceClass:['video','pdf'].includes(category)?'heavy':'medium'};
}
const pages=text('pages','页码（all 或 1,3-5）','Pages (all or 1,3-5)','all');
export const expandedTools: ToolDefinition[] = [
  tool('image.compress','压缩图片','Compress images','hybrid','file',[{...output,defaultValue:'webp'},quality,number('target_kb','目标体积（KB，0 不限制）','Target size (KB, 0 for no limit)',0,0,25600),text('background','JPG 背景色','JPEG background','#ffffff')]),
  tool('image.crop','裁剪图片','Crop image','local','file',[output,quality]),
  tool('image.rotate','旋转图片','Rotate images','hybrid','file',[output,select('rotation','角度（顺时针）','Clockwise rotation',['90','180','270','0']),quality]),
  tool('image.flip','翻转图片','Flip images','hybrid','file',[output,{...select('direction','方向','Direction',['horizontal','vertical','none']),options:[{value:'horizontal',label:l('水平','Horizontal')},{value:'vertical',label:l('垂直','Vertical')},{value:'none',label:l('不翻转','No flip')}]}]),
  tool('image.metadata','图片元数据','Image metadata','server','report'),
  tool('image.strip-metadata','移除图片元数据','Remove image metadata','hybrid','file',[output,quality,{key:'keep_icc',label:l('保留色彩配置','Keep color profile'),kind:'boolean',defaultValue:false}]),
  tool('image.favicon','生成网站图标','Create favicon','server','file',[select('fit','图标布局','Icon layout',['pad','crop'],'pad')]),
  tool('pdf.organize','整理 PDF 页面','Organize PDF pages','server','file'),
  tool('pdf.extract-pages','提取 PDF 页面','Extract PDF pages','server','file',[{...pages,defaultValue:'none'}]),
  tool('pdf.delete-pages','删除 PDF 页面','Delete PDF pages','server','file',[{...pages,defaultValue:'none'}]),
  tool('pdf.watermark','PDF 文字水印','PDF text watermark','server','file',[text('text','水印文字','Watermark text'),number('font_size','字号','Font size',36,8,120),number('opacity','不透明度（0–1）','Opacity (0–1)',.2,.01,1),number('rotation','角度','Rotation',45,-180,180),select('position','位置','Position',['center','top-left','top-right','bottom-left','bottom-right']),pages]),
  tool('pdf.page-numbers','添加 PDF 页码','Add PDF page numbers','server','file',[number('start','起始页码','Start number',1,0,100000),select('position','位置','Position',['bottom-center','bottom-left','bottom-right','top-center']),number('font_size','字号','Font size',12,6,72),number('margin','边距','Margin',24,0,100),select('format','格式','Format',['{n} / {total}','Page {n}','{n}']),pages]),
  tool('pdf.extract-images','提取 PDF 内嵌图片','Extract embedded PDF images','server','archive'),
  tool('pdf.metadata','PDF 元数据','PDF metadata','server','report',[{key:'remove',label:l('移除元数据并导出 PDF','Remove metadata and export PDF'),kind:'boolean',defaultValue:false}]),
  tool('pdf.unlock','解锁 PDF','Unlock PDF','server','file',[text('password','已有密码','Existing password')]),
  tool('pdf.ocr','扫描 PDF 识别','Recognize scanned PDF','server','file',[select('output','输出格式','Output format',['txt','docx']),select('language','识别语言','Recognition language',['eng','chi_sim','chi_sim+eng']),pages]),
  tool('pdf.protect','PDF 密码保护','Password protect PDF','server','file',[text('password','密码','Password'),text('confirm_password','确认密码','Confirm password')]),
  tool('audio.trim','裁剪音频','Trim audio','server','file',[select('output','输出格式','Output format',['mp3','wav']),text('start','开始时间','Start time','00:00:00'),text('end','结束时间','End time','00:00:10')]),
  tool('audio.merge','合并音频','Merge audio','server','file',[select('output','输出格式','Output format',['mp3','wav'])],true),
  tool('audio.normalize','统一音量','Normalize audio','server','file',[select('output','输出格式','Output format',['mp3','wav']),select('preset','用途','Preset',['general','podcast','music'])]),
  tool('video.compress','压缩视频','Compress video','server','file',[select('preset','压缩程度','Compression',['light','balanced','strong'],'balanced'),{key:'keep_resolution',label:l('保留原分辨率','Keep source resolution'),kind:'boolean',defaultValue:true}]),
  tool('video.trim','裁剪视频','Trim video','server','file',[text('start','开始时间','Start time','00:00:00'),text('end','结束时间','End time','00:00:10')]),
  tool('video.gif','视频转 GIF','Video to GIF','server','file',[text('start','开始时间','Start time','00:00:00'),number('duration','时长（秒，最多 15）','Duration (seconds, max 15)',5,1,15),number('width','宽度','Width',480,64,800),number('fps','帧率','FPS',12,1,20),select('quality','质量','Quality',['light','balanced','high'],'balanced')]),
  tool('video.frames','提取视频帧','Extract video frames','server','archive',[select('mode','模式','Mode',['even','interval','single']),number('count','帧数','Frame count',10,1,100),number('interval','间隔（秒）','Interval (seconds)',5,1,3600),text('start','指定时间','Timestamp','00:00:00'),select('image_format','图片格式','Image format',['jpg','png','webp'])]),
  tool('file.inspect','检查文件','Inspect file','server','report'),
  tool('file.hash','文件校验值','File checksum','local','report',[select('algorithm','算法','Algorithm',['sha256','sha1','md5']),text('expected','预期校验值（可选）','Expected checksum (optional)')]),
  tool('data.json-format','JSON 格式化','Format JSON','local','text',[select('indent','缩进','Indentation',['2','4','tab'])]),
  tool('data.json-minify','JSON 压缩','Minify JSON','local','text'),
  tool('data.json-validate','JSON 校验','Validate JSON','local','text'),
  tool('data.csv-json','CSV 转 JSON','CSV to JSON','local','text',[select('delimiter','分隔符','Delimiter',[',',';','tab']),{key:'header',label:l('首行为表头','First row is header'),kind:'boolean',defaultValue:true}]),
  tool('data.json-csv','JSON 转 CSV','JSON to CSV','local','text',[text('columns','导出列（逗号分隔）','Export columns (comma separated)'),{key:'flatten',label:l('展开嵌套对象','Flatten nested objects'),kind:'boolean',defaultValue:false}]),
  tool('data.json-yaml','JSON 转 YAML','JSON to YAML','local','text'),
  tool('data.yaml-json','YAML 转 JSON','YAML to JSON','local','text'),
  tool('archive.zip-create','创建 ZIP','Create ZIP','local','archive',[select('compression','压缩级别','Compression level',['0','1','6'],'1'),{key:'preserve_paths',label:l('保留目录','Keep folders'),kind:'boolean',defaultValue:true}],true),
  tool('archive.zip-extract','解压 ZIP','Extract ZIP','local','files'),
  tool('archive.inspect','检查 ZIP','Inspect ZIP','local','report'),
  tool('file.rename','批量重命名','Batch rename','local','archive',[select('mode','模式','Mode',['prefix','sequence','replace','lowercase','uppercase','date']),text('prefix','前缀','Prefix','file_'),text('suffix','后缀','Suffix'),text('find','查找','Find'),text('replace','替换','Replace'),number('start','起始序号','Start number',1,0,100000),number('digits','序号位数','Number padding',3,1,8),text('date','日期','Date')],true),
];

export const legacySchemas:Record<string,ToolSettingDefinition[]>={
 'image.convert':[select('output','输出格式','Output format',['preserve','jpg','png','webp','pdf'],'png'),quality,text('background','JPG 背景色','JPEG background','#ffffff'),{key:'combine_pages',label:l('多张图片合为一个 PDF','Combine images into one PDF'),kind:'boolean',defaultValue:true},select('page_size','纸张','Page size',['auto','a4','letter']),select('orientation','方向','Orientation',['auto','portrait','landscape']),select('margin','页边距','Page margin',['none','small','medium','large'])],
 'image.resize':[select('output','输出格式','Output format',['preserve','jpg','png','webp'],'preserve'),number('width','宽度（像素）','Width (pixels)',0,0,12000),number('height','高度（像素）','Height (pixels)',0,0,12000),number('percent','缩放百分比','Scale percent',100,1,500),{key:'lock_ratio',label:l('锁定比例','Lock aspect ratio'),kind:'boolean',defaultValue:true},quality],
 'pdf.convert':[select('output','输出格式','Output format',['png','jpg','txt','docx']),pages,number('dpi','DPI','DPI',144,72,300)],
 'pdf.merge':[], 'pdf.split':[text('pages','拆分范围（1-3;4-6）','Groups (1-3;4-6)','all')],
 'pdf.rotate':[pages,select('rotation','角度（顺时针）','Clockwise angle',['90','180','270'])], 'pdf.compress':[],
 'document.convert':[select('output','输出格式','Output format',['pdf'])],
 'audio.convert':[select('output','输出格式','Output format',['mp3','wav','flac','m4a','ogg','opus']),number('bitrate','码率（kbps）','Bitrate (kbps)',192,64,320),select('sample_rate','采样率','Sample rate',['0','44100','48000']),select('channels','声道','Channels',['0','1','2'])],
 'video.extract-audio':[select('output','输出格式','Output format',['mp3','wav']),number('bitrate','码率（kbps）','Bitrate (kbps)',192,64,320)],
 'video.convert':[select('output','输出格式','Output format',['mp4','webm','mkv']),select('resolution','最大高度','Maximum height',['0','480','720','1080','1440','2160']),select('fps','帧率','Frame rate',['0','24','30','60']),select('video_quality','质量','Quality',['very_high','high','medium','low'],'high')],
};
export function visibleSetting(id:string,key:string,s:Record<string,unknown>):boolean {
 if(id==='file.rename')return key==='mode'||(s.mode==='prefix'&&['prefix','suffix'].includes(key))||(s.mode==='replace'&&['find','replace'].includes(key))||(s.mode==='sequence'&&['prefix','start','digits'].includes(key))||(s.mode==='date'&&key==='date');
 if(id==='video.frames')return ['mode','image_format'].includes(key)||(s.mode==='even'&&key==='count')||(s.mode==='interval'&&key==='interval')||(s.mode==='single'&&key==='start');
 if(['combine_pages','page_size','orientation','margin'].includes(key)&&id==='image.convert')return s.output==='pdf';
 if(key==='quality')return !['png','pdf'].includes(String(s.output));
 if(key==='background')return s.output==='jpg';
 if(key==='bitrate')return !['wav','flac'].includes(String(s.output));
 if(id==='pdf.convert'&&key==='dpi')return ['png','jpg'].includes(String(s.output));
 return true;
}
