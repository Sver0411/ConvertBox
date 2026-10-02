import {localizeError,type Language} from '../messages';
const errors:Record<string,string>={
 'Choose a file':'请先选择文件。','Passwords do not match':'两次输入的密码不一致。','Find text cannot be empty.':'请填写要查找的文字。',
 'Text input exceeds 8 MB':'文本不能超过 8 MB。','Text input exceeds 8 MB.':'文本不能超过 8 MB。','Archive exceeds 64 MB':'ZIP 不能超过 64 MB。','Archive exceeds 64 MB.':'ZIP 不能超过 64 MB。',
 'JSON must be a non-empty array of flat objects.':'JSON 需要是非空的扁平对象数组。','Nested JSON is not supported. Flatten the objects first.':'请先展开嵌套对象；此工具仅支持扁平对象数组。',
 'CSV headers must be non-empty and unique.':'CSV 列名不能为空或重复。','CSV rows must have the same number of columns as the header.':'CSV 每行的列数需要与表头一致。',
 'CSV contains an invalid quoted field.':'CSV 引号格式有误。','CSV has an unclosed quote.':'CSV 引号没有闭合。','ZIP entry checksum does not match.':'ZIP 文件内容校验失败。',
 'Archive contains an unsafe path.':'ZIP 包含不安全的文件路径，已停止处理。','Uncompressed ZIP exceeds 64 MB.':'ZIP 解压后超过 64 MB。',
 'ZIP input exceeds 64 MB or 1000 entries.':'ZIP 输入不能超过 64 MB 或 1000 个文件。','Non-finite YAML numbers are not supported by JSON.':'JSON 不支持 YAML 中的无限值或非数值。',
 'This tool only accepts supported local inputs':'此工具需要选择支持的本地文件格式。','Invalid crop area.':'裁剪区域无效，请重新调整裁剪框。',
};
export function toolError(error:unknown,language:Language):string {
 const message=error instanceof Error?error.message:String(error);
 if(language==='en')return message;
 if(errors[message])return errors[message];
 if(message.includes('at most')&&message.includes('files'))return `文件数量超出限制（最多 ${message.match(/\d+/)?.[0]??'100'} 个）。`;
 if(message.includes('Image batch'))return '图片批量输入与结果最多 64 MB，请减少文件后重试。';
 if(message==='This tool accepts one file')return '此工具一次处理一个文件。';
 if(message.startsWith('JSON:'))return message.replace('JSON:','JSON 位置：').replace(/InvalidSymbol|ValueExpected/g,'此处需要有效的 JSON 值').replace(/PropertyNameExpected/g,'此处需要用双引号括起的字段名').replace(/ColonExpected/g,'缺少冒号').replace(/CommaExpected/g,'缺少逗号').replace(/CloseBraceExpected/g,'缺少右大括号').replace(/CloseBracketExpected/g,'缺少右方括号').replace(/EndOfFileExpected/g,'末尾存在多余内容');
 if(message.includes('alias')||message.includes('Alias'))return 'YAML 不支持别名引用，请展开内容后重试。';
 if(message.includes('ZIP'))return 'ZIP 无法安全处理，请检查文件格式、路径或大小。';
 return localizeError(message,language,error&&typeof error==='object'&&'code' in error?String(error.code):undefined);
}
