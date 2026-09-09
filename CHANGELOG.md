# 更新日志

版本号跟随上游 [`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness/releases)。

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
