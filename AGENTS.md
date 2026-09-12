# AGENTS.md — 给 AI 助手的项目须知

这份文档写给**接手本仓库的 AI 助手**（也适合人类快速上手）。README 讲的是"怎么用 / 怎么发版"，这里讲的是**"为什么这么做"、"哪里一定会踩雷"、"改完怎么验证"**。

先把最重要的三条放在最前面：

1. **改版本号必须改两处**，只改 `package.json` 会打出一个版本号没变、客户端永远收不到的包。
2. **绝对不要从"复制出来的目录"启动 dsh**（例如为了测试把 `resources/dsh` 复制到临时目录再运行）。dsh 启动时会把 `~/.dsh/profiles` 里的 608 个 junction **重指向正在运行的那份安装**，复制目录一删，装机版就废了。这是真实发生过的事故，见 §6。
3. **不要以为读了源码就等于验证过**。本项目的几个关键结论（启动为什么慢、安装为什么慢、杀软影响多少）都是**实测**出来的，而且结论和直觉相反（见 §4、§5）。

---

## 1. 项目是什么

- 把上游 [DeepSeek Harness（`dsh`）](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 包成 Windows 桌面软件。
- 本质是 **Electron 壳 + 内嵌完整运行时**：`resources/node/node.exe`（Node 24）+ `resources/dsh/node_modules`（dsh 及其依赖，10552 个文件）+ `resources/pnpm`（dsh 的插件管理需要）。用户机器上**不需要装任何东西**。
- 上游只提供 `npx @deepseek-ai/dsh web` 和源码两条路，**没有官方桌面版**。本项目的价值就是"双击即用"。

### 运行时是怎么跑起来的（`main.js`）

1. 探测 `127.0.0.1:3080`：如果已经有**真正的 dsh**（靠 HTML 里的 `__DSH_BOOT__` 标记，或 dsh ≥ 0.1.2-rc.1 的 401 + "dsh web authentication required"）→ **直接附着，不再另起进程**。
2. 端口被别的程序占用 → 用 `--port 0` 让系统分配。
3. 否则 `spawn(node.exe, [dsh/bin.js, 'web', '--port', '3080', '--no-open'])`，从 stdout 抓 `dsh web: http://127.0.0.1:<port>/?token=...` 这一行（含一次性 token，必须用它加载，否则页面要鉴权）。
4. 关窗时 `taskkill /PID <pid> /T /F` 清掉整棵进程树（这是产品特性："关闭后无残留进程"）。

**spawn 环境变量的坑（真实事故）**：双击启动的 Electron 从 Explorer 继承的路径键是 `Path`，而 `main.js` 早期写法 `{...process.env, PATH: ...}` 会在子进程环境块里留下 `Path` + `PATH` 两个条目。Windows 变量名不区分大小写，重复键会损坏环境块——后果是 dsh 派生的每个控制台进程（`cmd.exe`、`where.exe`，即 agent 跑工具时）都弹 `0xc0000142`。修复是 `buildDshEnv()`：合并所有大小写变体后只写一个 `PATH`。改这段代码时务必保持单键。

**推论（很重要）**：只要 3080 上已经有 dsh 在跑，新启动的 GUI 就只是"连上去"，用的还是**那个旧内核**。想测试新构建的运行时，必须先关掉正在运行的实例，否则测的是旧的。

---

## 2. 版本与发布

版本号**始终跟随上游 `@deepseek-ai/dsh`**。

### 2.1 改版本号必须同时改两处

| 文件 | 位置 | 作用 |
|---|---|---|
| `scripts/prepare-resources.mjs` | `dependencies: { [DSH_PACKAGE]: '0.1.5-rc.2' }` | **真正决定装哪个 dsh**，重打包时按这个版本重新拉依赖树 |
| `package.json` | `"version": "0.1.5-rc.2"` | 决定安装包文件名、注册表 DisplayVersion、electron-updater 的版本比对 |

只改后者 → 内置还是旧 dsh；只改前者 → 安装包版本号不变，老用户永远收不到更新（electron-updater 按版本号判断）。

### 2.2 npm tag 陷阱

`@deepseek-ai/dsh` 的 dist-tags（2026-09-11）：

```
latest = 0.1.5-rc.1     ← npm install 默认拿到的
next   = 0.1.5-rc.2     ← 真正的更新在这里
alpha  = 0.1.5-alpha.2
```

**必须写死精确版本**，不能用 `^` 或 `latest`，否则永远落后一个版本。

### 2.3 发版流程

```powershell
# 1. 改上面两个文件里的版本号（两处！）
# 2. 重新拉依赖树（会 rm -rf resources/dsh 后重装，并剪掉约 1.2 万个运行时无用文件）
npm run prepare
# 3. 打包（--publish never 防止误发到 GitHub）
npm run dist -- --publish never
# 4. 提交 + 打 tag（tag 名不带 v，例如 0.1.5-rc.2，与历史一致）
git add -A ; git commit ; git tag -a <version> -m "..."
# 5. push + 建 Release，见 §2.4
```

`scripts/verify-resources.mjs` 会在 `dist` 前自动校验内嵌运行时完整性（防"缺依赖的坏包"），缺了会自动重跑 prepare。

### 2.4 Release 必须上传的东西

```
DeepSeek-Harness-GUI-Setup-<version>.exe
DeepSeek-Harness-GUI-Setup-<version>.exe.blockmap
DeepSeekHarnessGUI-portable.exe
latest.yml          ← 少了这个，客户端检测不到更新
```

**已知问题（务必注意）**：公开 Release 长期落后于 `main`。当 Release 上的 `latest.yml` 版本低于本地已装版本时，`main.js` 的自动更新会记录：

```
[updater] Update for version 0.1.5-rc.2 is not available (latest version: 0.1.2-rc.1, downgrade is disallowed)
```

即**自动更新实际处于失效状态**。每次发版都要确认 Release 里的 `latest.yml` 是新的。

`DeepSeekHarnessGUI-portable.exe` 的文件名不带版本号，重新构建会**静默覆盖**旧的便携版，需要留存就先改名备份。

---

## 3. 构建与验证清单

### 3.1 验证产物（每次打包后至少做这些）

```powershell
$res = 'C:\Program Files\DeepSeek Harness GUI\resources'   # 或 release\win-unpacked\resources
# a. 内置 dsh 版本
(Get-Content "$res\dsh\node_modules\@deepseek-ai\dsh\package.json" -Raw | ConvertFrom-Json).version
# b. 打包后的运行时能起来（冒烟测试）
& "$res\node\node.exe" "$res\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" --version
# c. 安装包/便携版版本号
(Get-Item 'release\DeepSeek-Harness-GUI-Setup-<version>.exe').VersionInfo.FileVersion
Get-Content 'release\latest.yml' | Select-Object -First 3
```

### 3.2 启动路径的端到端验证（推荐）

`main.js` 依赖 stdout 里 `dsh web: <url>` 这一行。可以空跑一次确认它还在（**必须用 `--port 0`，不要抢 3080**）：

```powershell
$node = "$res\node\node.exe"; $bin = "$res\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js"
$p = Start-Process -FilePath $node -ArgumentList @("`"$bin`"", 'web', '--port', '0', '--no-open') `
     -RedirectStandardOutput out.log -RedirectStandardError err.log -NoNewWindow -PassThru
# 等 out.log 出现 "dsh web: http://127.0.0.1:<port>/?token=..." 后：
taskkill /PID $p.Id /T /F
```

> ⚠️ **PowerShell 5.1 的坑**：`Start-Process -ArgumentList` 不会给含空格的参数加引号。`C:\Program Files\...` 会被截成 `C:\Program`，报 `Cannot find module 'C:\Program'`。必须像上面那样写成 `` "`"$bin`"" ``。

### 3.3 启动耗时怎么量

解析 `%TEMP%\deepseek-harness-gui-boot.log`，每个 `main.js loaded` 到 `UI loaded` 是一轮启动：

```powershell
$lines = Get-Content "$env:TEMP\deepseek-harness-gui-boot.log"
# 关注三行的时间差： "dsh spawned" → "server up=true" （这一段的耗时就是内置 dsh 的启动成本）
#                    "main.js loaded" → "dsh spawned" （壳自身，通常 0.5s 左右）
```

---

## 4. 启动性能：结论与证据（别重复走弯路）

参考机（Samsung 980 PRO NVMe / Windows / Defender 实时防护开启）实测：

| 场景 | 点击图标 → 界面就绪 |
|---|---|
| 冷态（重启后 / 空闲后），无排除项 | 15 ~ 18 s |
| 冷态，**安装目录已加入 Defender 排除** | **5.3 s** |
| 刚跑过一次（页缓存热） | 2.2 ~ 4.4 s |

拆解：**Electron 壳只占 0.5 s，其余全在内置 dsh 启动**（加载 10552 个模块文件）。

已经**排除**的无效方案（都实测过，别再试）：

- `NODE_COMPILE_CACHE`：三次实测 4.61 / 4.63 / 4.35 s，与基线 4.36 / 4.35 s 无差别，缓存目录 **0 字节**（根本没生成）→ 瓶颈不是 JS 编译。
- 磁盘吞吐：系统盘是 NVMe SSD，不是瓶颈。
- "新文件被 Defender 扫描"：把模块树复制成全新副本（未排除）启动只要 3.82 s → 说明慢的不是"扫描新文件"。

**有效的方案**：把安装目录加进 Defender 排除列表。已由安装器提供（默认勾选的「启动加速」页），手动加：

```powershell
Add-MpPreference -ExclusionPath 'C:\Program Files\DeepSeek Harness GUI'
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.dsh\profiles"   # 里面是 608 个 junction
# 撤销
Remove-MpPreference -ExclusionPath 'C:\Program Files\DeepSeek Harness GUI'
Remove-MpPreference -ExclusionPath "$env:USERPROFILE\.dsh\profiles"
```

> 需要管理员。这是**安全权衡**：这些路径不再被实时扫描。安装器里做成了显式勾选，不要改成静默强制。

---

## 5. 安装耗时：**不是**杀软的问题

参考机上一次覆盖安装：解压写入 11085 个文件耗时 **约 91 秒**（用安装目录文件的 CreationTime 分布反推）。三个操作的 A/B（1737 文件样本，有/无 Defender 排除）：

| 操作 | 未排除 | 已排除 |
|---|---|---|
| **创建**新文件 | 0.7 s | 0.6 s |
| **删除**文件 | 0.23 s | 0.23 s |
| **覆盖**已有文件 | **13.4 s** | **0.2 s** |

结论：

- Defender 只惩罚"**覆盖**已有文件"；安装器走的是"旧卸载器删除 → 全新写入"，正好避开慢路径。
- 因此那 91 秒是 **7z/LZMA 解压 865 MB 载荷的纯 CPU 开销**（约 9.5 MB/s，单线程）。
- **不要把 Defender 排除项提前到解压之前**——实测收益接近零，还会造成"用户取消安装却已经改了排除项"的副作用。当前实现放在 `customInstall`（解压之后）是刻意的。

真要显著加快安装只有一个杠杆：`compression` 改成 `store`（安装 ~15 s，但安装包从 234 MB 涨到约 870 MB）。分发场景不划算，除非是局域网/U 盘分发。

---

## 6. ⚠️ 历史事故：别从复制目录启动 dsh

**事故经过**：为了测冷启动，把 `resources/dsh` 复制到 `C:\deepseekhamness\coldtest` 并从那里启动 dsh。dsh 的 profile 引导逻辑（`healProfilesModuleFallback`）会把 `~/.dsh/profiles` 下 **608 个 junction 重指向"当前正在运行的那份安装"**，也就是那个临时副本。副本一删，装机版的插件解析全部指向不存在的路径 → **重启 App 会起不来**。

**为什么会这样**：`~/.dsh/profiles/node_modules/@deepseek-ai/*` 不是真目录，是指向当前安装的 junction：

```
C:\Users\Administrator\.dsh\profiles\node_modules\@deepseek-ai\dsh
  → C:\Program Files\DeepSeek Harness GUI\resources\dsh\node_modules\@deepseek-ai\dsh
```

**修复方法**：从**正确的安装目录**启动一次 dsh，它会自愈（重指向回来）：

```powershell
$res = 'C:\Program Files\DeepSeek Harness GUI\resources'
& "$res\node\node.exe" "$res\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 0 --no-open
# 抓到 "dsh web:" 后 kill 掉；然后核对：
Get-ChildItem "$env:USERPROFILE\.dsh\profiles" -Recurse -Force -Directory |
  Where-Object LinkType | Group-Object { ($_.Target -join ',') -replace '\\node_modules\\.*$','' }
# 期望：全部指向 C:\Program Files\DeepSeek Harness GUI\resources\dsh
```

**衍生结论**：不要为了"并存"而运行 `npx @deepseek-ai/dsh web --port 8080`——它会把 junction 改指到 npx 缓存，缓存一清装机版同样会坏。真要并行测试，**单独指定 `DSH_HOME`**。

**教训**：任何"复制运行时目录 + 启动它"的实验都可能污染用户真实 profile。要用隔离环境就设 `DSH_HOME=<临时目录>`。

---

## 7. NSIS 安装器的硬约束（`build/installer.nsh`）

这个文件由 electron-builder 放在**共享头**里，而共享头是拼在模板之前的（`NsisTarget.js`：`sharedHeader + computeFinalScript(...)`）。因此：

1. **`customPageAfterChangeDir` 会在 `assistedInstaller.nsh` 第 43 行展开**，位置在「选择安装目录」页之后、「安装进度」页之前——这正是"启动加速"页所在的位置。
2. **NSIS 把警告当错误**（`warning treated as error`）。典型：声明了 `Var` 却没用到 → `warning 6001: Variable ... not referenced or never set`。
   - 卸载器那一趟编译**不会**展开安装页和 `customInstall`，所以给安装页用的变量必须放在只在安装趟展开的地方（当前实现是放在 `customPageAfterChangeDir` 宏体内部，干净且不需要 `BUILD_UNINSTALLER` 判断）。
3. **`MUI_HEADER_TEXT` 只能在 Function 内调用**（它内部用 `SendMessage`），而且它依赖 `MUI2.nsh`——而共享头是在 MUI2 之前被处理的。所以**页面函数必须定义在 `customPageAfterChangeDir` 宏体里**（那个宏展开时 MUI2 已就位），不能放在文件顶层的 `Function ... FunctionEnd` 里，否则报：
   - `SendMessage not valid outside Section or Function`
   - 或 `!insertmacro: macro named "MUI_HEADER_TEXT" not found!`
4. `${isUpdated}` 是 electron-builder 提供的（判断"这次卸载是不是更新流程的一部分"）。**卸载器在更新时也会被调用**，所以在 `customUnInstall` 里删 Defender 排除项必须加 `${IfNot} ${isUpdated}`，否则每次自动更新都会把用户的排除项悄悄抹掉。
5. **静默安装**（electron-updater 的更新、或 `/S`）不会显示任何页面，页面函数也不会执行 → 相关变量为空，此时应当"保持首次安装的决定"，不要报错。
6. 便携版（`portable` target）**不会加载 `build/installer.nsh`**（`NsisTarget` 里有 `if (!this.isPortable)` 判断），所以便携版没有"启动加速"页。

### 未验证项

`${isUpdated}` 保护**尚未在真实更新流程中实测**（上次覆盖安装用的是"还没有这段逻辑的旧卸载器"）。下次自动更新后执行一次即可核实：

```powershell
(Get-MpPreference).ExclusionPath   # 期望：更新后两条排除项仍然在
```

---

## 8. 数据目录与兼容性

- 数据全在 `~/.dsh`（`sessions/`、`profiles/`、`settings.yaml`、`.credentials.yaml`），**与命令行版完全共享**。
- 会话格式：`0.1.5-alpha.1` 起是 **V3**，升级后的会话**不支持降级读取**。从更早的版本（≤0.1.2-rc.1）升级会触发不可逆迁移，回退前要先备份。
- `~/.dsh/profiles/web` 是 profile 目录，`~/.dsh/profiles/node_modules` 是指向当前安装的 junction 场（见 §6）。
- 同一 session 同时只能被一个进程持有（dsh 的 session 锁）。别让两个实例同时操作同一个会话。

---

## 9. 诊断手册

| 想知道什么 | 看哪里 |
|---|---|
| 启动卡在哪一步、各阶段耗时 | `%TEMP%\deepseek-harness-gui-boot.log`（`_diag` 写入，含每阶段时间戳） |
| dsh 服务的 stdout/stderr、spawn 参数、kill 记录 | `%APPDATA%\deepseek-harness-gui\dsh-server.log` |
| 自动更新是否生效 | 上面两个日志里的 `[updater]` 行 |
| 当前排除项 | `(Get-MpPreference).ExclusionPath` |
| profile junction 是否健康 | §6 里的 `Group-Object` 命令 |
| 是否有残留 dsh 进程 | `Get-CimInstance Win32_Process -Filter "Name='node.exe'" \| Select ProcessId,CommandLine`（看有没有 `bin.js web` 那条） |
| 已安装版本 | `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` 里 DisplayName 含 DeepSeek 的项；或 exe 的 `VersionInfo.FileVersion` |

> 注意：`dsh-subprocess-local` 会让**你自己的每次命令**也表现为一个 `node.exe` 子进程（`runner.js -- powershell.exe ...`）。排查残留进程时别把自己算进去。

---

## 10. 其它约定

- **提交信息用英文**，风格参考历史：`Sync upstream dsh 0.1.5-rc.2`、`Fix duplicate desktop shortcuts on update: ...`。
- 版本号跟随上游，tag 名**不带 `v`**（`0.1.5-rc.2`）。未 push 前可以 `git tag -f` 移动到包含全部改动的最新提交。
- `release/`、`resources/`、`node_modules/` 都在 `.gitignore` 里——**不要提交构建产物**。
- 改完 `main.js` / `installer.nsh` / 打包脚本后，必须重新构建并**至少**跑 §3.1 的校验；涉及启动路径的改动再跑 §3.2。
- 不要在用户机器上做"先卸载再装"的破坏性验证；也不要在 GUI 正在运行时去覆盖它（那个进程很可能正托管着用户的会话界面）。

---

## 11. 当前状态（2026-09-11）

- 版本：`0.1.5-rc.2`（内置 `@deepseek-ai/dsh` 0.1.5-rc.2）
- 已实现：Defender 排除安装页（默认勾选）、更新时保留排除项、卸载时移除排除项
- 已实测：启动 15~18 s → 5.3 s；安装耗时的成本归因（§5）
- **待办**：
  1. 目视确认安装向导里确实出现「启动加速」页（机制上已验证宏在页面注册点展开，二进制搜索因 NSIS 压缩无法作为证据）
  2. `git push origin main` + `git push origin <tag>`（本地领先若干提交）
  3. 创建 GitHub Release 并上传 §2.4 的四个文件，修复当前失效的自动更新链路
