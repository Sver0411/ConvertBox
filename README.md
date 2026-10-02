# ConvertBox

一个隐私友好、自托管的文件处理工作台，用于转换、压缩、检查、整理和批量处理常见文件。

A privacy-friendly, self-hosted file workbench for converting, compressing, inspecting, organizing and batch-processing everyday files.

中文优先，手写英文界面；无账号、无第三方转换 API。[MIT](LICENSE)。桌面端工具中心支持搜索、收藏、最近使用、Cmd/Ctrl+K 和稳定工具 URL。

## 功能

| 分类 | 已实现 |
|---|---|
| Images | 格式转换、缩放、压缩、可视化裁剪、旋转、翻转、元数据查看/移除、ICC 可选保留、六尺寸 favicon |
| PDF | 转换、合并、拆分、旋转、优化、缩略图页面整理、提取/删除页面、文字水印、页码、提取内嵌图片、元数据查看/移除、AES-256 密码保护 |
| Documents | Word、表格、演示文稿转 PDF；PDF 可选择文字导出 TXT/DOCX |
| Audio | 转换、裁剪、按序合并、音量统一 |
| Video | 转换、提取音频、压缩、裁剪、GIF、抽帧 |
| Data | JSON 格式化/压缩/校验，JSON ↔ CSV，JSON ↔ YAML |
| Archives | 创建/解压 ZIP，目录检查、选择下载 |
| File utilities | 文件检查、分块 SHA-256/SHA-1/MD5、校验值核对、批量重命名预览与 ZIP 下载 |

[工具目录](docs/TOOLS.md)从唯一前端 Tool Registry 生成：`npm run generate-tool-docs`。工具定义 46 项；服务端工具及输出由运行环境能力收窄，不可用工具不出现在工具中心。

## 处理方式

数据、Hash、ZIP、重命名在浏览器运行。常规静态 JPG/PNG/WebP 图片优先本地处理；HEIC、AVIF、TIFF、ICO 和受限 SVG、PDF、Office、音视频由自托管服务器处理。SVG 需要 Cairo 系统库，未安装时不开放该转换能力。

转换任务保留 Converter Registry，非转换操作使用 ToolHandlerRegistry。统一 ToolExecution 支持文件、多文件、下载链接、文本和报告结果。工具页面使用统一设置与任务模型，裁剪和 PDF 页面整理提供专用编辑界面。

## 边界

- 本地图片单文件 ≤25 MB，批量输入/结果各 ≤64 MB、≤100 个文件，估算内存预算 256 MiB；动画转换明确拒绝。
- PDF 编辑 ≤200 页；预览与报告 ≤16 MiB；服务器输出默认 ≤512 MiB。
- ZIP 压缩/解压后数据各 ≤64 MiB，≤1000 项；不支持 ZIP64、加密 ZIP、旧式非 UTF-8 名称。
- 数据文本 ≤8 MiB；JSON/CSV 仅支持扁平对象数组，YAML 禁止别名。
- 媒体时长 ≤1 小时；GIF ≤15 秒；抽帧 ≤100 张。
- PDF 转 DOCX 提取可选择文字，不保留原排版；扫描版无 OCR。加密 PDF 输入不能编辑，TIFF 多页编辑暂不支持。
- 收藏、预设与历史记录保存在当前浏览器；历史不保存原文件。复用记录需重新选择文件。旧预设迁移保留原数据，密码与粘贴内容不进入预设/历史。

完整边界与安全策略见 [Workbench Security](docs/WORKBENCH_SECURITY.md)、[架构](docs/ARCHITECTURE.md)和 [Phase 8 Review](PHASE_8_REVIEW.md)。

## 本地开发

默认直接运行，不需要 Docker。需要 Node.js 22+、npm 10+、Python 3.11+、[uv](https://docs.astral.sh/uv/)、FFmpeg 和 LibreOffice。运行：

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

参见[直接部署说明](docs/DEPLOYMENT.md)。当前任务队列是进程内实现，因此 API 只应运行一个实例。仓库保留了早期的 Compose 文件；由于本次开发机器内存不足，第 7–8 阶段未构建或运行 Docker 镜像，也未将其加入 CI。

## 隐私与安全

每个文件在转换前显示“本地”或“服务器”。本地转换不会上传文件。服务器任务保存在随机的独立目录，结果默认保留 1 小时；后台周期清理。上传按 1 MB 块读写，默认每个请求最多 1 GB，并受上传并发、等待数、磁盘容量和每 IP 速率限制。文件名经过清理；服务器重新验证签名，FFmpeg 与 LibreOffice 使用参数数组调用。历史记录仅在当前浏览器的 IndexedDB 中保存元数据。详见[资源限制](docs/RESOURCE_LIMITS.md)、[隐私](docs/PRIVACY.md)与[安全](docs/SECURITY.md)。

## 已知限制与后续

- 服务器处理中的任务不能中断；排队中的任务可以取消。
- 视频输出当前使用 H.264 或 VP9；H.265/AV1 高级选择、断点续传、独立分布式 Worker 尚未实现。
- 批量 ZIP 仅包含浏览器内保留的本地结果，最大 64 MB，生成时仍使用内存缓冲；服务器结果需逐个下载。
- PDF 优化尝试压缩对象，但结果不保证比原文件小。
- SVG 仅支持受限安全子集；系统级 CPU/内存沙箱隔离仍未实现。大型转换的吞吐与峰值内存尚未测量，参见 [BENCHMARKS.md](BENCHMARKS.md)。

各阶段完成与未完成内容见 `PHASE_X_REVIEW.md`。设计基线见 [PHASE_0_DESIGN.md](PHASE_0_DESIGN.md)。
