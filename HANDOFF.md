# HANDOFF.md — 交接简报（2026-09-18）

> **给接手本项目的 AI 助手（Kimi）**：这份文档是"现在是什么状态 + 下一步做什么"。
> 项目的机制、踩雷清单、验证方法都在 [AGENTS.md](AGENTS.md)，**请先读它**（尤其 §2 版本与发布、§3 验证清单、§6 历史事故、§7 NSIS 约束）。
> 本文档里的所有数字都是 **2026-09-18 实测**的，不是回忆。

---

## 0. 一句话任务

把内置 dsh 从 `0.1.5-rc.2` 升到 **`0.1.6-alpha.2`**，重新打包，发布新 Release。

**两件事必须一起办：**

1. 上游 09-17 发布了 `0.1.6-alpha.2`（插件管理页、文件改动卡片、Office 预览、侧栏终端/浏览器、**启动等待时间优化**）
2. **有一个已经修好、但永远发不出去的 bug 修复**（PATH env-key → `0xc0000142`）。它必须靠这次版本号抬升才能送到用户手里 —— 原因见 §3，这是最容易搞错的地方

---

## 1. 项目速览（30 秒）

- 把 DeepSeek Harness（`dsh`）的 Web UI 包成 Windows 桌面软件：Electron 壳 + 内嵌 Node 24 + dsh 全依赖 + pnpm，用户机器上不用装任何环境。
- `main.js` 启动时起 `node.exe resources/dsh/.../bin.js web --port 3080 --no-open`，从 stdout 抓 `dsh web: http://...` 拿到带 token 的 URL 加载窗口；3080 上已有 dsh 就直接附着。
- 构建两条命令：`npm run prepare`（拉 dsh 依赖树）→ `npm run dist -- --publish never`（打包到 `release/`）。
- 项目路径：`C:\Users\Administrator\deepseek-harness-gui`

---

## 2. 当前状态（2026-09-18 实测）

### 2.1 源码

- 远端 `main` = **`4d84f70`**（已推送，本地与远端一致，无未提交改动）
- 最近提交：

```
4d84f70  Document the PATH env-key pitfall in AGENTS.md
fa3e09c  Fix 0xc0000142 in agent-spawned console processes: normalize PATH env key
b6983e2  Document the project for AI assistants          ← AGENTS.md 首次加入
3ce95ee  Offer to exclude the bundled runtime from Windows Defender
73da3bd  Sync upstream dsh 0.1.5-rc.2
```

### 2.2 GitHub Release（对外能下载到的最新版）

| 项 | 值 |
|---|---|
| tag / 标题 | `0.1.5-rc.2` / `DeepSeek Harness GUI 0.1.5-rc.2` |
| 发布 | 2026-09-11 10:28（本地时间），非 draft、非预发布、带 **Latest** |
| 附件 | Setup `245565584` 字节 `sha256:a6cf12ba…e40c8`；blockmap `180129` `ea4a2203…`；portable `245330468` `3b99e550…`；latest.yml `384` `58422f23…` |
| 下载统计 | latest.yml **16 次**、Setup exe **2 次** → **自动更新链路已验证可用**，确实有客户端在查更新 |

### 2.3 本地 `release/` 里是**另一次构建**（没发布）

- 构建时间 **09-12 10:06**，产物：Setup `245565837` 字节 `934B0506…`、portable `245330721` `8F3B247C…`、latest.yml `5EF71A5F…`（releaseDate `2026-09-12T02:09:04Z`）
- 它比线上那份**新**，并且**包含 PATH 修复**（已核对：`release/win-unpacked/resources/app.asar` 里 `0xc0000142` 注释命中）
- 但它顶着同一个版本号 `0.1.5-rc.2` → **永远发不出去**（§3）

### 2.4 本机已安装版本

- `C:\Program Files\DeepSeek Harness GUI` = **09-11 09:55 的构建**（`app.asar` 2183869 字节，**不含 PATH 修复**），全用户安装
- 也就是说：这台机器自己也在用没有修复的那一份

### 2.5 上游 dsh

| 版本 | 时间 | 通道 |
|---|---|---|
| `0.1.6-alpha.2` | 09-17 | alpha ← **最新** |
| `0.1.6-alpha.1` | 09-15 | alpha |
| `0.1.5-rc.2` | 09-10 | 现在同时是 npm 的 `latest` |

npm dist-tags（09-18 实测）：`latest=0.1.5-rc.2`、`next=0.1.5-rc.2`、`alpha=0.1.6-alpha.2`

- **值得升**：插件管理页（可安装/配置/实时启停插件）、回合结束的文件改动卡片 + 侧栏逐文件审阅、Office（Word/Excel/PPT）预览、侧栏终端与浏览器模式、"改善 CLI 及 Web 启动等候时间"
- **破坏性变更（对本封装影响小，但要知道）**：PTC 包名统一为 `ptc-runtime`（旧名不兼容）、`agent/session-start` → `agent/created`、移除内置 E2B、默认模型列表移除 V4 Flash 与 V4 Flash Vision Exp、工作流执行器改为 `workflow-ptc`、插件依赖改为运行时解析

---

## 3. ⚠️ 为什么必须抬版本号（最容易搞错的一点）

electron-updater 是**按版本号比较**的：已经装了 `0.1.5-rc.2` 的用户，**永远不会**被提示"更新到 0.1.5-rc.2"。所以：

> 修复了一个 bug 却用同一个版本号重新发布 = 谁都收不到（包括你自己这台机器）。

这正是现在的处境：PATH 修复在源码里（`fa3e09c`）、在 09-12 的本地构建里，但**没有任何用户拿到**。要送达，只能把版本号抬上去 —— 正好和上游 `0.1.6-alpha.2` 一起发。

---

## 4. 要做的事（照抄）

### 步骤 1｜改两处版本号（**必须都改**，细节见 AGENTS.md §2.1）

| 文件 | 改成 |
|---|---|
| `scripts/prepare-resources.mjs` | `dependencies: { '@deepseek-ai/dsh': '0.1.6-alpha.2' }` ← **真正决定装哪个 dsh** |
| `package.json` | `"version": "0.1.6-alpha.2"` ← 决定安装包名、注册表版本、更新比对 |

必须写**精确版本**，不能用 `^` 或 `latest`。

### 步骤 2｜拉依赖树

```powershell
cd C:\Users\Administrator\deepseek-harness-gui
npm run prepare
```

会 `rm -rf resources/dsh` 后重新用 pnpm 安装，并剪掉约 1.2 万个运行时无用文件。

### 步骤 3｜验证内置版本 + 冒烟测试（**务必用隔离的 DSH_HOME**）

```powershell
$res = 'C:\Users\Administrator\deepseek-harness-gui\release\win-unpacked\resources'
# 期望 0.1.6-alpha.2
(Get-Content "$res\dsh\node_modules\@deepseek-ai\dsh\package.json" -Raw | ConvertFrom-Json).version
& "$res\node\node.exe" "$res\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" --version

# web 冒烟：确认 stdout 仍有 "dsh web: http://127.0.0.1:<port>/?token=..." 这一行
# （main.js 的正则依赖它；0.1.6 动过 Web/CLI 启动路径，必须查）
$env:DSH_HOME = 'C:\temp\dsh-smoke'      # ← 关键！见下面的警告
$p = Start-Process -FilePath "$res\node\node.exe" `
     -ArgumentList @("`"$res\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js`"", 'web', '--port', '0', '--no-open') `
     -RedirectStandardOutput C:\temp\smoke.out -RedirectStandardError C:\temp\smoke.err -NoNewWindow -PassThru
# 等到 smoke.out 出现 "dsh web: " 后：
taskkill /PID $p.Id /T /F
```

> ⚠️ **为什么必须设 `DSH_HOME`**：dsh 启动时会把 `~/.dsh/profiles` 下的 **608 个 junction 重指向"当前正在运行的那份安装"**。如果从 `release\win-unpacked\resources` 启动而没隔离，junction 就指向 `win-unpacked`，之后清理/移走这个目录会让**装机版起不来**。完整事故经过与恢复命令见 AGENTS.md §6。
> 如果确实用了真实 `DSH_HOME` 测试，测完必须**从安装目录再启动一次**让它自愈，并用 AGENTS.md §6 的 `Group-Object` 命令核对指向。

### 步骤 4｜打包

```powershell
npm run dist -- --publish never
```

`--publish never` 是防止误发到 GitHub。`predist` 会自动校验内嵌运行时完整性。

### 步骤 5｜验证产物

见 AGENTS.md §3.1。至少要确认：安装包/便携版的 `FileVersion`、`latest.yml` 的 `version` 都是 `0.1.6-alpha.2`。

### 步骤 6｜提交 + tag + push

```powershell
git add -A
git commit -m "Sync upstream dsh 0.1.6-alpha.2"
git tag -a 0.1.6-alpha.2 -m "DeepSeek Harness GUI 0.1.6-alpha.2 (bundles @deepseek-ai/dsh 0.1.6-alpha.2)"
git push origin main
git push origin 0.1.6-alpha.2
```

**网络注意（实测）**：本机 git 走本地代理 —— 仓库级 `http.proxy = socks5h://127.0.0.1:10808`，全局 `http/https.proxy = http://127.0.0.1:10808`。

- ✅ 代理正常时 push 没问题（凭据已存在 Windows 凭据管理器，`credential.helper=manager`，不需要输密码）
- ❌ **直连 github.com 是不通的**（实测 21 秒超时），所以**不要**用 `git -c http.proxy= …` 去绕过代理
- 若报 `Failed to connect to github.com port 443 via 127.0.0.1`：是代理客户端（本地 10808 那个）没在正常工作，**启动它 / 等它重连后重试**即可（09-18 那次就是瞬时失败，重试就成功了）

### 步骤 7｜发 GitHub Release

- tag 选刚推上去的 `0.1.6-alpha.2`
- **四个附件一个都不能少**：`Setup-0.1.6-alpha.2.exe`、同名 `.exe.blockmap`、`DeepSeekHarnessGUI-portable.exe`、**`latest.yml`**
- 发行标签保持选「**最新的**」，**不要**勾「预发布」、**不要**点「保存草稿」（draft 客户端读不到）
- 漏掉 `latest.yml` = 等于没发版

---

## 5. 验证清单（做完逐条打勾）

- [ ] `resources/dsh/package.json` 的依赖 与 `resources/dsh/node_modules/@deepseek-ai/dsh/package.json` 的 version 都是 `0.1.6-alpha.2`
- [ ] 冒烟：`--version` 输出 `0.1.6-alpha.2`
- [ ] 冒烟：web 启动仍打印 `dsh web: http://127.0.0.1:<port>/?token=...`（格式变了就要改 `main.js` 第 ~126 行的正则）
- [ ] 安装包与便携版的 `VersionInfo.FileVersion` = `0.1.6-alpha.2`；`latest.yml` 的 `version` 一致
- [ ] Release 有 4 个附件、非 draft、非预发布、带 Latest 标记
- [ ] （顺手）安装向导里「启动加速」页是否存在 —— 见 §7
- [ ] 测试用的临时 `DSH_HOME` 目录已清理；若用过真实 `DSH_HOME`，junction 指向已核对

---

## 6. Release 说明模板（替换 `<>` 里的内容）

````markdown
跟随上游 `@deepseek-ai/dsh` 升级至 **0.1.6-alpha.2**。

DeepSeek Harness（dsh）的 Windows 桌面封装版：内嵌 Node.js v24 + dsh 0.1.6-alpha.2 完整依赖 + pnpm，
无需安装任何环境、无需打开命令行，安装后填入 DeepSeek API Key 即可使用。

## 本版变化

- 内置 dsh 由 0.1.5-rc.2 升级至 0.1.6-alpha.2
- 修复主程序注入 PATH 环境变量时的键名重复问题：Explorer 启动的应用继承的是 `Path`，
  而代码写的是 `PATH`，两个键同时存在会让子进程环境块损坏，导致 dsh 派生的控制台进程
  （cmd.exe / where.exe 等）报 0xc0000142 初始化失败
- 安装器仍提供「启动加速」选项（默认勾选）：把安装目录加入 Windows Defender 排除列表

上游主要变化：新增插件管理页（可安装、配置、实时启停插件）；回合结束显示文件改动卡片并可在侧栏逐文件审阅；
侧栏支持 Office（Word/Excel/PPT）预览、浏览器模式访问 URL、打开 Subagent 会话；工作区按目录层级分组；
改善 CLI 与 Web 启动等候时间。注意：PTC 包名统一为 `ptc-runtime`、默认模型列表移除 V4 Flash 系列，
使用自定义插件或配置的请对照上游说明调整。

## 下载

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `DeepSeek-Harness-GUI-Setup-0.1.6-alpha.2.exe` | <大小> MB | 安装版（推荐，支持自动更新） |
| `DeepSeekHarnessGUI-portable.exe` | <大小> MB | 绿色便携版，双击即用（无自动更新，也没有「启动加速」页） |

校验值：

| 文件 | MD5 | SHA256 |
| --- | --- | --- |
| `DeepSeek-Harness-GUI-Setup-0.1.6-alpha.2.exe` | `<MD5>` | `<SHA256>` |
| `DeepSeekHarnessGUI-portable.exe` | `<MD5>` | `<SHA256>` |

Windows 下校验（命令行直接粘贴）：

`certutil -hashfile DeepSeek-Harness-GUI-Setup-0.1.6-alpha.2.exe MD5`

`certutil -hashfile DeepSeek-Harness-GUI-Setup-0.1.6-alpha.2.exe SHA256`

> `latest.yml` 和 `.blockmap` 是自动更新清单文件，不用下载。

## 使用说明

1. 双击桌面图标启动，跟随引导页进入 **Settings → Models** 填入 API Key（`sk-...`）
2. 点击 **Choose workspace** 选择项目目录，开始会话

## 注意

- Windows SmartScreen 可能提示「未知发布者」（开源项目无付费签名），点「更多信息 → 仍要运行」即可
- 安装需解压约 865 MB 载荷，约 1~2 分钟，进度条可能长时间不动，请勿取消
- 上游 dsh 仍为开发者预览版，遇到问题请到 Issues 反馈，并附上 `%TEMP%\deepseek-harness-gui-boot.log`
- 会话数据格式为 V3，升级后的会话不支持降级读取
````

---

## 7. 尚未验证的历史遗留项

1. **安装向导「启动加速」页从未被目视确认**。机制上是验证过的（NSIS 宏确实在页面注册点展开、编译通过、页面函数被引用），但因为 NSIS 把脚本 LZMA 整体压缩，二进制搜索无法作为证据。任何人装一次都能顺手看清（那页标题是「启动加速」，一个默认打勾的复选框 + 三行说明）。
2. **`${isUpdated}` 保护未在真实更新流程里实测**。逻辑是：自动更新时旧卸载器也会被调用，所以卸载器里删 Defender 排除项那段加了 `${IfNot} ${isUpdated}`，避免每次更新都把用户的排除项抹掉。下次真实更新后跑一次即可核实：
   ```powershell
   (Get-MpPreference).ExclusionPath   # 期望：两条排除项仍然在
   ```
3. **0.1.6 是否改了 web 启动的 stdout 格式**（步骤 3 的冒烟就是查这个）。

---

## 8. 环境备忘（这台机器）

| 项 | 值 |
|---|---|
| 项目路径 | `C:\Users\Administrator\deepseek-harness-gui` |
| 安装路径 | `C:\Program Files\DeepSeek Harness GUI`（全用户安装） |
| 数据目录 | `C:\Users\Administrator\.dsh`（与 `npx @deepseek-ai/dsh` 命令行版共享） |
| PowerShell | **只有 Windows PowerShell 5.1，没有 `pwsh`** |
| Node / npm | v24.14.0 / 11.9.0 |
| 杀软 | Windows Defender 实时防护开启；已为本程序加了两条排除项（AGENTS.md §4） |
| git 代理 | 必须走本地代理（§4 步骤 6），直连不通 |

两个容易浪费时间的坑：

- **PS 5.1 的 `Start-Process -ArgumentList` 不给含空格的参数加引号**：`C:\Program Files\...` 会被截成 `C:\Program`，报 `Cannot find module 'C:\Program'`。写法：`` "`"$bin`"" ``（AGENTS.md §3.2）
- 你**自己的每条命令**都会表现为一个 `node.exe` 子进程（`dsh-subprocess-local\lib\runner.js -- powershell.exe ...`）。排查"残留 dsh 进程"时别把自己算进去（AGENTS.md §9）

---

## 9. 禁止事项（精简版，完整论述见 AGENTS.md）

1. **不要从复制出来的目录启动 dsh** —— 会把 `~/.dsh/profiles` 的 junction 重指过去，删掉副本后装机版起不来（真实事故，AGENTS.md §6）
2. **不要用同一个版本号重新发布** —— 谁都收不到（§3）
3. **不要 `git add release/ resources/`** —— 已在 `.gitignore` 里，别强加
4. **不要在 GUI 正在运行时覆盖安装它** —— 那个进程很可能正托管着用户正在用的会话界面
5. **不要静默修改用户的杀软配置** —— 安装器里那个勾选是"显式同意"，别再偷偷加强制逻辑
6. 不要把 Defender 排除项提前到解压之前 —— 实测收益接近零，还会造成"取消安装却已改配置"的副作用（AGENTS.md §5）
