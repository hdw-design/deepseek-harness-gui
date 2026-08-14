# DeepSeek Harness GUI

把 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 打包成 Windows 桌面软件：双击即用，内嵌 Node.js 运行时 + dsh 全部依赖，无需安装任何环境。

## 特性

- 双击启动，自动拉起本地 `dsh web` 服务（`127.0.0.1:3080`）并打开桌面窗口
- 全部依赖内嵌：Node.js v24、`@deepseek-ai/dsh` 完整依赖树、pnpm（dsh 插件管理需要）
- 与命令行版共享数据：模型配置、会话记录都在 `~/.dsh`，两边互通
- 已在运行的 dsh 实例会被直接复用，不重复启动
- 关闭窗口自动清理后台进程；单实例运行

## 下载

见 [Releases](https://github.com/hdw-design/deepseek-harness-gui/releases)：

- `DeepSeek Harness GUI Setup x.y.z.exe` — 安装版
- `DeepSeekHarnessGUI-portable.exe` — 绿色便携版，双击即用

## 从源码构建

需要 Windows + Node.js 22.19+（或 24+）。

```bash
git clone https://github.com/hdw-design/deepseek-harness-gui.git
cd deepseek-harness-gui
npm install          # 安装 electron / electron-builder
npm run prepare      # 下载并组装 resources/（Node 运行时 + dsh + pnpm）
npm start            # 开发模式运行
npm run dist         # 打包，产物在 release/
```

`npm run prepare` 支持镜像环境变量（国内网络）：

```bash
# Git Bash 示例
export NODEJS_MIRROR=https://npmmirror.com/mirrors/node/
export NPM_REGISTRY=https://registry.npmmirror.com
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run prepare
```

## 同步 dsh 新版本

DeepSeek 官方更新 harness 后，重新执行 `npm run prepare`（会拉取最新 `@deepseek-ai/dsh`），然后 `npm run dist` 重新打包即可。

## 工作原理

`main.js` 在应用启动时以子进程方式运行内嵌的 `node.exe resources/dsh/.../bin.js web`，轮询 `127.0.0.1:3080` 就绪后用 `BrowserWindow` 加载；若端口已有 dsh 在跑则直接附着。窗口关闭时通过 `taskkill /T` 清理整棵进程树。

排错日志：

- 启动流程：`%TEMP%\deepseek-harness-gui-boot.log`
- dsh 服务输出：`%APPDATA%\DeepSeek Harness GUI\dsh-server.log`

## License

MIT（与上游 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 相同）
