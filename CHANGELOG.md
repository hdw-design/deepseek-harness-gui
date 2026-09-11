# 更新日志

版本号跟随上游 [`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness/releases)。

## 0.1.5-rc.2（2026-09-11）

- 内置 `@deepseek-ai/dsh` 由 `0.1.5-alpha.1` 升级至 `0.1.5-rc.2`（跟随上游 `next` 通道，覆盖 alpha.2、rc.1、rc.2 三个版本）
- 注意：npm 的 `latest` 标签仍停留在 `0.1.5-rc.1`，`0.1.5-rc.2` 只发布在 `next` 标签下，因此版本号必须写死为精确版本，不能用 `^` 或 `latest`
- **安装器新增「启动加速」页（默认勾选）**：可把安装目录与当前用户的 `.dsh\profiles` 加入 Windows Defender 排除列表。内置运行环境有 1 万多个文件，实时扫描会让冷启动从约 5 秒涨到 15~18 秒；实测排除后冷启动回落到 5.3 秒。卸载时自动移除排除项，静默更新（electron-updater）则保留原有选择

上游主要变化（自 0.1.5-alpha.1 起）：

- **通用文件上传**：Web 支持任意类型文件，与图片在同一预览区混排，后台上传带进度与取消，模型可按保存路径读取
- **右侧 Sidebar**：多标签、分栏、全屏，支持 Markdown、代码高亮、HTML、PDF、图片预览，模型可显式交付文件
- **模型探测**：支持自定义 provider 的 `models` 对象与 Anthropic 原生模型列表，自动回填模型名、上下文窗口与最大输出
- **代理支持**：所有出站请求遵循 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` / `NO_PROXY`
- **顶栏「在应用中打开」**：用已安装的编辑器、IDE、终端或文件管理器打开 Workspace
- **反馈**：可脱离对话独立提交，`/feedback` 支持明细内容
- **子代理**：可继续对话的子代理支持消息排队、编辑、删除与 Steer
- **修复**：Windows 盘符根目录 Workspace、Web 断线后无法自动恢复、发送后聊天不自动滚动、Windows 文件夹选择器被遮挡等

⚠️ 注意：会话数据格式为 V3，升级后的会话不支持降级读取（`0.1.5-alpha.1` 起已是 V3，本次升级不触发迁移）。

## 0.1.5-alpha.1（2026-09-08）

- 内置 `@deepseek-ai/dsh` 由 `0.1.2-rc.1` 升级至 `0.1.5-alpha.1`（alpha 预览版，跟随上游 alpha 通道）
- 升级后需用 `npm run prepare` 重新拉取 alpha 依赖树，再 `npm run dist` 重新打包

## 0.1.1-rc.2（2026-08-25）

- 内置 `@deepseek-ai/dsh` 由 `0.1.0-rc.6` 升级至 `0.1.1-rc.2`，覆盖上游 rc.7、rc.8、0.1.1-rc.1、0.1.1-rc.2 四个版本

上游主要变化：

- **多模态视觉**：新增视觉理解模型 `DeepSeek-V4-Flash-Vision-Exp`；图片优先通过 Files API 上传并可复用，自动按模型要求缩放和转换格式；`/goal`、`/plan` 等命令支持图文输入
- **子代理**：Claude Code 与 Codex 子代理可按需安装（Profile Bundle），支持非交互权限模式和多个命名实例，任务接入 Job Panel
- **Windows 终端**：PTY 支持持久 PowerShell 会话，极简模式预设默认启用；升级 node-pty 1.2 beta 改善兼容性
- **问题修复**：超大图片或历史图片累计载荷过高导致模型请求失败；部分自定义 OpenAI 兼容网关无法调用及推理内容缺失；取消流式生成后回复前缀未带入后续提问；大历史消息分页栈溢出等
- **体验优化**：`web_search` 并发查询、会话 Markdown 表格自适应、插件自注册设置卡片、DeepSeek 模型新增 `low` 推理强度等

⚠️ 注意：上游 rc.8 重构了 SQLite 存储（读写更快、体积更小），**旧版本会话数据格式不兼容**。

## 0.1.0-rc.6（2026-08-14）

- 首个公开版本：内置 dsh `0.1.0-rc.6`、Node.js 24 运行时和 pnpm，开箱即用
- 支持 GitHub Releases 自动更新
