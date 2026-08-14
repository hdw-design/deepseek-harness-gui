# DeepSeek Harness GUI

把 [DeepSeek Harness（dsh）](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 打包成 Windows 桌面软件：双击即用，内嵌 Node.js 运行时 + dsh 全部依赖，无需安装任何环境。

## 特性

- 双击启动，自动拉起本地 `dsh web` 服务（默认 `127.0.0.1:3080`）并打开桌面窗口
- 全部依赖内嵌：Node.js v24、`@deepseek-ai/dsh` 完整依赖树、pnpm（dsh 插件管理需要）
- 首次启动显示引导页（配置 API Key 三步说明）；全新环境首启可离线完成 profile 初始化
- 与命令行版共享数据：模型配置、会话记录都在 `~/.dsh`，两边互通
- 已在运行的 dsh 实例会被直接复用（通过页面特征识别，不会误附着其他程序）；3080 被其他程序占用时自动改用随机空闲端口
- 启动过程分阶段提示（检测服务 → 启动服务 → 等待就绪 → 加载界面）
- 关闭窗口自动清理后台进程；单实例运行
- 自动更新：安装版启动时检查 GitHub Releases，发现新版本自动下载，提示重启更新（便携版无此功能）
- 构建保护：`npm run dist` 前自动校验内嵌运行时完整性（防缺依赖的坏包）

版本号跟随上游 `@deepseek-ai/dsh`（当前 `0.1.0-rc.6`）。

## 下载

见 [Releases](https://github.com/hdw-design/deepseek-harness-gui/releases)：

- `DeepSeek-Harness-GUI-Setup-x.y.z.exe` — 安装版（支持自动更新）
- `DeepSeekHarnessGUI-portable.exe` — 绿色便携版，双击即用（无自动更新）

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

## 同步 dsh 新版本（发版流程）

版本号始终与上游 `@deepseek-ai/dsh` 保持一致。官方发布新版后：

```bash
# 1. 把 package.json 的 version 改成 dsh 的新版本号（如 0.1.0-rc.7）
# 2. 拉取新版 dsh 并重新组装 resources/
npm run prepare
# 3. 打包
npm run dist
```

然后在 GitHub 上新建 Release（tag 用版本号，如 `0.1.0-rc.7`），上传 `release/` 目录下这些文件：

- `DeepSeek-Harness-GUI-Setup-x.y.z.exe`（安装版）
- `DeepSeek-Harness-GUI-Setup-x.y.z.exe.blockmap`
- `DeepSeekHarnessGUI-portable.exe`（便携版）
- **`latest.yml`**（自动更新清单，必须上传，否则客户端检测不到更新）

已安装的旧版本下次启动时会自动检测到新 Release 并提示更新。

## 工作原理

`main.js` 在应用启动时以子进程方式运行内嵌的 `node.exe resources/dsh/.../bin.js web`，轮询 `127.0.0.1:3080` 就绪后用 `BrowserWindow` 加载；若端口已有 dsh 在跑则直接附着。窗口关闭时通过 `taskkill /T` 清理整棵进程树。

排错日志：

- 启动流程：`%TEMP%\deepseek-harness-gui-boot.log`
- dsh 服务输出：`%APPDATA%\DeepSeek Harness GUI\dsh-server.log`

## License

MIT（与上游 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 相同）
