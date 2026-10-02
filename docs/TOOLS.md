# Tool Catalog

Generated from the frontend Tool Registry. Run `npm run generate-tool-docs` after changes. Server tools are shown only when the running server advertises them.

| ID | 中文 | English | Inputs | Result | Processing | Resource |
|---|---|---|---|---|---|---|
| image.compress | 压缩图片 | Compress images | image/* | file | hybrid | medium |
| image.crop | 裁剪图片 | Crop image | image/jpeg, image/png, image/webp | file | local | medium |
| image.rotate | 旋转图片 | Rotate images | image/* | file | hybrid | medium |
| image.flip | 翻转图片 | Flip images | image/* | file | hybrid | medium |
| image.metadata | 图片元数据 | Image metadata | image/* | report | server | medium |
| image.strip-metadata | 移除图片元数据 | Remove image metadata | image/* | file | hybrid | medium |
| image.favicon | 生成网站图标 | Create favicon | image/* | file | server | medium |
| pdf.organize | 整理 PDF 页面 | Organize PDF pages | application/pdf | file | server | heavy |
| pdf.extract-pages | 提取 PDF 页面 | Extract PDF pages | application/pdf | file | server | heavy |
| pdf.delete-pages | 删除 PDF 页面 | Delete PDF pages | application/pdf | file | server | heavy |
| pdf.watermark | PDF 文字水印 | PDF text watermark | application/pdf | file | server | heavy |
| pdf.page-numbers | 添加 PDF 页码 | Add PDF page numbers | application/pdf | file | server | heavy |
| pdf.extract-images | 提取 PDF 内嵌图片 | Extract embedded PDF images | application/pdf | archive | server | heavy |
| pdf.metadata | PDF 元数据 | PDF metadata | application/pdf | report | server | heavy |
| pdf.protect | PDF 密码保护 | Password protect PDF | application/pdf | file | server | heavy |
| audio.trim | 裁剪音频 | Trim audio | audio/* | file | server | medium |
| audio.merge | 合并音频 | Merge audio | audio/* | file | server | medium |
| audio.normalize | 统一音量 | Normalize audio | audio/* | file | server | medium |
| video.compress | 压缩视频 | Compress video | video/* | file | server | heavy |
| video.trim | 裁剪视频 | Trim video | video/* | file | server | heavy |
| video.gif | 视频转 GIF | Video to GIF | video/* | file | server | heavy |
| video.frames | 提取视频帧 | Extract video frames | video/* | archive | server | heavy |
| file.inspect | 检查文件 | Inspect file | * | report | server | medium |
| file.hash | 文件校验值 | File checksum | * | report | local | medium |
| data.json-format | JSON 格式化 | Format JSON | * | text | local | medium |
| data.json-minify | JSON 压缩 | Minify JSON | * | text | local | medium |
| data.json-validate | JSON 校验 | Validate JSON | * | text | local | medium |
| data.csv-json | CSV 转 JSON | CSV to JSON | * | text | local | medium |
| data.json-csv | JSON 转 CSV | JSON to CSV | * | text | local | medium |
| data.json-yaml | JSON 转 YAML | JSON to YAML | * | text | local | medium |
| data.yaml-json | YAML 转 JSON | YAML to JSON | * | text | local | medium |
| archive.zip-create | 创建 ZIP | Create ZIP | * | archive | local | medium |
| archive.zip-extract | 解压 ZIP | Extract ZIP | * | files | local | medium |
| archive.inspect | 检查 ZIP | Inspect ZIP | * | report | local | medium |
| file.rename | 批量重命名 | Batch rename | * | archive | local | medium |
| image.convert | 图片格式转换 | Convert images | image/* | file | hybrid | medium |
| image.resize | 调整图片尺寸 | Resize images | image/* | file | hybrid | medium |
| pdf.convert | PDF 转换 | Convert PDF | application/pdf | file | server | heavy |
| pdf.merge | 合并 PDF | Merge PDF | application/pdf | file | server | medium |
| pdf.split | 拆分 PDF | Split PDF | application/pdf | archive | server | medium |
| pdf.rotate | 旋转 PDF 页面 | Rotate PDF pages | application/pdf | file | server | medium |
| pdf.compress | 优化 PDF | Optimize PDF | application/pdf | file | server | medium |
| document.convert | 文档转 PDF | Documents to PDF | .doc, .docx, .odt, .xls, .xlsx, .ods, .ppt, .pptx, .odp | file | server | medium |
| audio.convert | 音频转换 | Convert audio | audio/* | file | server | medium |
| video.convert | 视频转换 | Convert video | video/* | file | server | heavy |
| video.extract-audio | 提取视频音频 | Extract video audio | video/* | file | server | medium |
