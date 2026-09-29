# ConvertBox

简洁、无账号的文件转换工作台。中文界面为默认，支持手写英文界面切换。JPG、PNG、WebP 的常规转换与尺寸调整在浏览器完成；PDF、Office、HEIC、AVIF、音频、视频等任务由自托管服务器处理。无第三方转换 API。

[MIT 许可证](LICENSE)。

## 截图

![首页](docs/screenshots/home.png)

![转换工作区](docs/screenshots/workspace.png)

![手机工作区](docs/screenshots/mobile-workspace.png)

## 已实现

- 自动检测文件签名，逐个隔离不支持或损坏的文件；最多添加 100 个文件。
- 图片格式转换、尺寸调整、质量设置；浏览器支持时使用 Web Worker。
- PDF 转 PNG/JPG（按页打包 ZIP、页码和 DPI）、提取 TXT/DOCX 文本、合并、拆分、旋转、优化；图片按指定顺序合成 PDF，可选页面尺寸、方向与边距。
- DOC/DOCX/ODT、XLS/XLSX/ODS、PPT/PPTX/ODP 转 PDF（需要 LibreOffice）。
- 常见音频格式互转、视频转换与提取音频（需要 FFmpeg）；音视频输出选项按服务器编码器检测结果提供。
- 有界后台队列、实际 FFmpeg 进度、取消排队任务、失败重试、独立下载与浏览器端批量 ZIP。
- IndexedDB 仅保存转换记录和设置，不保存文件；提供内置和自定义预设。
- 浅色、深色和跟随系统主题；键盘快捷键 Cmd/Ctrl+O 与 Cmd/Ctrl+Enter。
- 桌面端左侧按图片、PDF、Word、音频、视频分类；记录与说明在同一工作区切换。转换类别通过 URL 参数可直接打开，长文件列表在面板内部滚动。

## 架构

```text
浏览器 File API ─→ 文件签名检测 ─→ 本地图片 Web Worker / Canvas ─→ Blob 下载
                           │
                           └→ Next.js 同源代理 → FastAPI 流式上传
                                                → Job Manager → 有界队列 → Converter Registry
                                                → 临时结果 → 下载 / 1 小时后清理
```

服务端 Worker 当前与 API 在同一进程的后台线程中，部署单个 API 实例。部署多个 API 副本需要先把任务状态、队列和临时文件迁至共享基础设施。参见[架构](docs/ARCHITECTURE.md)与[转换流程](docs/CONVERSION_PIPELINE.md)。

## 格式

| 输入 | 输出或操作 | 位置 |
| --- | --- | --- |
| JPG、PNG、WebP | JPG、PNG、WebP，尺寸调整 | 本地（单文件 ≤25 MB） |
| JPG、PNG、WebP、BMP、GIF、HEIC/HEIF、AVIF | JPG、PNG、WebP、AVIF、PDF（按实际编码器能力） | 服务器 |
| PDF | PNG、JPG、TXT、DOCX；合并、拆分、旋转、优化 | 服务器 |
| DOC、DOCX、ODT、XLS、XLSX、ODS、PPT、PPTX、ODP | PDF | 服务器 |
| MP3、WAV、FLAC、AAC、M4A、OGG、OPUS | MP3、WAV、FLAC、M4A、OGG、OPUS（按编码器能力） | 服务器 |
| MP4、MOV、MKV、WebM、AVI | MP4、WebM、MKV、MP3、WAV（按编码器能力） | 服务器 |

PDF 转 DOCX 只提取可选择的文字，不保留原排版；扫描版 PDF 不做 OCR。PDF 页面图片输出为 ZIP。图片可移除元数据，或经服务器保留 EXIF 与色彩配置；其他元数据类型未保证保留。SVG 尚未开放。动态 WebP、APNG 和 GIF 会明确拒绝转换，避免丢失动画。格式表会由 `/capabilities` 根据运行环境收窄，界面只展示实际可用的输出。

## 本地开发

需要 Node.js 22+、npm 10+、Python 3.11+、[uv](https://docs.astral.sh/uv/)、FFmpeg 和 LibreOffice。运行：

```bash
npm ci
cd apps/api && uv sync --extra test && cd ../..
npm run dev
```

网页位于 `http://localhost:3000`，API 位于 `http://localhost:8000`。`npm run dev` 同时启动两者；`npm run dev:web` 仅启动网页。若 FFmpeg 或 LibreOffice 未安装，对应格式不会出现在服务端能力列表。配置可参考 [.env.example](.env.example)。

## 测试

```bash
npm run lint
npm run typecheck
npm run test
npm run test:api
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run test:load
```

API 测试使用真实图片、PDF、Office 和音视频文件并检查可读取的结果。浏览器测试的完整流程在 Chromium 运行，关键流程在 Chromium、Firefox、WebKit 运行；为控制内存，浏览器测试只使用一个 worker。`test:load` 是轻量的确定性并发回归测试，扩展的真实 HTTP 测试见 [说明](tests/load/README.md)。CI 在 push 与 pull request 运行上述检查。

## 部署

参见[直接部署说明](docs/DEPLOYMENT.md)。当前任务队列是进程内实现，因此 API 只应运行一个实例。仓库保留了早期的 Compose 文件；由于本次开发机器内存不足，第 7 阶段未构建或运行 Docker 镜像，也未将其加入 CI。

## 隐私与安全

每个文件在转换前显示“本地”或“服务器”。本地转换不会上传文件。服务器任务保存在随机的独立目录，结果默认保留 1 小时；后台周期清理。上传按 1 MB 块读写，默认每个请求最多 1 GB，并受上传并发、等待数、磁盘容量和每 IP 速率限制。文件名经过清理；服务器重新验证签名，FFmpeg 与 LibreOffice 使用参数数组调用。历史记录仅在当前浏览器的 IndexedDB 中保存元数据。详见[资源限制](docs/RESOURCE_LIMITS.md)、[隐私](docs/PRIVACY.md)与[安全](docs/SECURITY.md)。

## 已知限制与后续

- 服务器处理中的任务不能中断；排队中的任务可以取消。
- 视频输出当前使用 H.264 或 VP9；H.265/AV1 高级选择、断点续传、独立分布式 Worker 尚未实现。
- 批量 ZIP 仅包含浏览器内保留的本地结果，最大 64 MB，生成时仍使用内存缓冲；服务器结果需逐个下载。
- PDF 优化尝试压缩对象，但结果不保证比原文件小。
- SVG、其他图片元数据、安全沙箱级 CPU/内存隔离仍需进一步实现和审核。大型转换的吞吐与峰值内存尚未测量，参见 [BENCHMARKS.md](BENCHMARKS.md)。

各阶段完成与未完成内容见 `PHASE_X_REVIEW.md`。设计基线见 [PHASE_0_DESIGN.md](PHASE_0_DESIGN.md)。
