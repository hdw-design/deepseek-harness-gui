# HANDOFF.md — 交接简报（2026-09-29）

> **给接手本项目的 AI 助手**：这份文档是"现在是什么状态 + 下一步做什么"。
> 项目的机制、踩雷清单、验证方法都在 [AGENTS.md](AGENTS.md)，**请先读它**（尤其 §2 版本与发布、§3 验证清单、§6 历史事故、§7 NSIS 约束）。
> 本文档里的所有数字都是 **2026-09-29 实测**的，不是回忆。

---

## 0. 一句话任务

**`0.2.0-rc.1` 已经打包、发布、装机完成。现在没有进行中的任务。**

下一次升级时，照 §4 的步骤做即可（把版本号换成当时上游的最新版）。

**唯一待办（可选优化）**：pnpm 体积瘦身，见 §7。

---

## 1. 项目速览（30 秒）

- 把 DeepSeek Harness（`dsh`）的 Web UI 包成 Windows 桌面软件：Electron 壳 + 内嵌 Node 24 + dsh 全依赖 + pnpm，用户机器上不用装任何环境。
- `main.js` 启动时起 `node.exe resources/dsh/.../bin.js web --port 3080 --no-open`，从 stdout 抓 `dsh web: http://...` 拿到带 token 的 URL 加载窗口；3080 上已有 dsh 就直接附着。
- 构建两条命令：`npm run prepare`（拉 dsh 依赖树）→ `npm run dist -- --publish never`（打包到 `release/`）。
- 项目路径：`C:\Users\Administrator\deepseek-harness-gui`
- 为什么有人用：用户要的是**双击即用**，不想每次敲 `npx @deepseek-ai/dsh web`。官方桌面端（`download.deepseek.com/dsh-desk/`）功能等价，但**要实名认证 + 账户余额**；本封装只要一个 API Key。这是本项目的存在理由。

---

## 2. 当前状态（2026-09-29 实测）

### 2.1 源码

- 远端 `main` = **`da5610d`**（已推送，本地与远端一致）
- 最近提交：

```
da5610d  Sync upstream dsh 0.2.0-rc.1              ← 当前 HEAD（tag: 0.2.0-rc.1）
d457d06  Sync upstream dsh 0.1.6-alpha.2
e5718c9  Add a handoff brief for the next maintainer
4d84f70  Document the PATH env-key pitfall in AGENTS.md
fa3e09c  Fix 0xc0000142 in agent-spawned console processes: normalize PATH env key
```

- tag：`0.1.1-rc.2`、`0.1.5-rc.2`、`0.1.6-alpha.2`、**`0.2.0-rc.1`**
- `git status` 干净；`release/` 与 `resources/` 均被 `.gitignore` 忽略（勿强加）

### 2.2 GitHub Release（对外能下载到的最新版）

| 项 | 值 |
|---|---|
| tag / 标题 | `0.2.0-rc.1` / `DeepSeek Harness GUI 0.2.0-rc.1` |
| 发布 | 2026-09-29 15:44（本地时间），非 draft、非预发布 |
| 附件 | Setup `330183491` 字节 `md5:4bbaede4d0049208773679a84275e5c4` `sha256:82cf3301…fc5094`；blockmap `250292`；portable `329948356` `md5:7af1cd647fcf2993c78a759544723f62`；latest.yml `384` |
| 状态 | **四个附件齐全 → 自动更新链路已接通**（旧版长期缺失 `latest.yml` 的问题已解决） |

### 2.3 本机已安装版本

- `C:\Program Files\DeepSeek Harness GUI` = **`0.2.0-rc.1`**（2026-09-29 装机，全用户安装）
- 已验证：主程序 `FileVersion = 0.2.0-rc.1`、注册表 `DisplayVersion = 0.2.0-rc.1`、内置 dsh `0.2.0-rc.1`、网页 HTTP 200 且带 `__DSH_BOOT__` 标记、根路径 401（鉴权正常）
- 用户报告：**双击后几秒钟就起来了**（Defender 排除项生效的效果）

### 2.4 上游 dsh

| 版本 | npm tag | 时间 |
|---|---|---|
| `0.2.0-rc.1` | **`next`** | 09-28 20:34 |
| `0.1.7-rc.2` | **`latest`** | 09-24 22:18 |
| `0.1.7-rc.1` | — | 09-23 21:44 |
| `0.1.7-alpha.2` | `alpha` | 09-23 00:08 |
| `0.1.6-alpha.2` | — | 09-17 21:52 |

npm dist-tags（09-29 实测）：`latest=0.1.7-rc.2`、`next=0.2.0-rc.1`、`alpha=0.1.7-alpha.2`

**注意 `latest` 与 `next` 的分叉**：`latest` 停在 `0.1.7-rc.2`，`0.2.0-rc.1` 挂在 `next`。本项目选择跟随 `next`（用户明确要求"最新版"）。下次升级前先确认想跟哪条通道。

**0.2.0-rc.1 新增/修复（摘自 release notes）**：

- 定时任务：创建/管理提醒、查看运行记录，重启后保留，最短每分钟重复一次
- 桌面端新增首次使用引导（介绍可用额度、帮助选择用途）；关窗后任务继续后台运行，退出前提示影响
- Web 与桌面端支持查看/搜索/自定义/恢复快捷键
- 支持动态增加工具且不破坏 KV Cache；自动审阅拒绝后允许人工决定是否继续
- 修复：部分桌面安装包启动失败、插件详情/设置页无法显示插件信息、应用异常退出或安装中断后插件安装持续失败、过长工具输出字符残缺导致后续对话失败、浏览器把登录密码误填进 API Key 输入框

---

## 3. ⚠️ 为什么必须抬版本号（最容易搞错的一点）

electron-updater 是**按版本号比较**的：已经装了 `X` 的用户，**永远不会**被提示"更新到 `X`"。所以：

> 修复了一个 bug 却用同一个版本号重新发布 = 谁都收不到（包括你自己这台机器）。

历史上真发生过：PATH 修复（`fa3e09c`）在源码里、在 09-12 的本地构建里，但顶着和线上相同的 `0.1.5-rc.2` 版本号，**一个用户都没拿到**，直到 09-18 抬到 `0.1.6-alpha.2` 才送出去。

**每次发版前确认：`package.json` 的 `version` 与 `scripts/prepare-resources.mjs` 里的 dsh 版本都是"没发过的新号"。**

---

## 4. 下次升级照抄（步骤）

### 步骤 1｜改两处版本号（**必须都改**，细节见 AGENTS.md §2.1）

| 文件 | 改成 |
|---|---|
| `scripts/prepare-resources.mjs`（约 L141） | `dependencies: { [DSH_PACKAGE]: '<新版本>' }` ← **真正决定装哪个 dsh** |
| `package.json`（L3） | `"version": "<新版本>"` ← 决定安装包名、注册表版本、更新比对 |

必须写**精确版本**，不能用 `^` 或 `latest`。

### 步骤 2｜拉依赖树

```powershell
cd C:\Users\Administrator\deepseek-harness-gui
npm run prepare
```

会 `rm -rf resources/dsh` 后重新用 pnpm 安装，并剪掉约 1.2 万个运行时无用文件。实测 `0.2.0-rc.1` 耗时 **11 秒**（含下载 537 个包），产出 11795 文件 / 354.8 MB。

**pnpm 会打印一条 `Ignored build scripts:` 警告（列出 node-pty / koffi / protobufjs 等）。这是正常的，不要试图 `pnpm approve-builds`** —— 实测对比过：旧版（`0.1.6`，公认可用）打包出的同名包**同样没有 `.node` 文件**，说明这些包靠 `prebuilds/` 预编译产物工作，不依赖安装期构建。判定方法见 §5 步骤 3。

### 步骤 3｜验证内置版本 + 冒烟测试（**务必用隔离的 DSH_HOME**）

```powershell
$p = 'C:\Users\Administrator\deepseek-harness-gui'
$env:DSH_HOME = 'C:\temp\dsh-smoke'          # ← 铁律：隔离，见 §6

# a. 版本
(Get-Content "$p\resources\dsh\node_modules\@deepseek-ai\dsh\package.json" -Raw | ConvertFrom-Json).version

# b. 可执行性
& "$p\resources\node\node.exe" "$p\resources\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" --version

# c. 启动输出格式（main.js 的正则是 /dsh web: (https?:\/\/\S+)/，必须仍然匹配）
$proc = Start-Process -FilePath "$p\resources\node\node.exe" `
  -ArgumentList @("`"$p\resources\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js`"",'web','--port','0','--no-open') `
  -RedirectStandardOutput 'C:\temp\smoke.out' -RedirectStandardError 'C:\temp\smoke.err' -NoNewWindow -PassThru
# 等 C:\temp\smoke.out 出现 "dsh web: http://127.0.0.1:<port>/?token=..."，然后：
taskkill /PID $proc.Id /T /F
```

**`0.2.0-rc.1` 实测输出（格式未变，`main.js` 无需改动）：**

```
dsh web: http://127.0.0.1:51599/?token=sQBqzTqXNcPB7n3Fc2kaqVxhIx0lAQrO2KdukJn3wtM
```

### 步骤 4｜打包

```powershell
npm run dist -- --publish never
```

`predist` 会先跑 `verify-resources.mjs` 校验内嵌运行时完整性（缺了会自动重跑 prepare）。

实测 `0.2.0-rc.1`：Setup **314.89 MB**、portable **314.66 MB**，耗时数分钟。electron-builder 会做 signtool 签名步骤（无证书，仅走流程）。

### 步骤 5｜验证产物（AGENTS.md §3.1）

```powershell
$rel = "$p\release"
(Get-Item "$rel\DeepSeek-Harness-GUI-Setup-<version>.exe").VersionInfo.FileVersion   # 必须是新版本号
Get-Content "$rel\latest.yml" | Select-Object -First 1                               # version: <新版本>
(Get-Item "$rel\DeepSeekHarnessGUI-portable.exe").VersionInfo.FileVersion
# 打包后运行时冒烟（用 win-unpacked 里的那份）
$env:DSH_HOME='C:\temp\dsh-smoke'
& "$rel\win-unpacked\resources\node\node.exe" "$rel\win-unpacked\resources\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js" --version
```

### 步骤 6｜提交 + 打 tag + 推送 + 发 Release

```powershell
git add -A ; git commit -m "Sync upstream dsh <version>"
git tag -a <version> -m "DeepSeek Harness GUI <version> (bundles @deepseek-ai/dsh <version>)"
git push origin main
git push origin <version>
```

**git 必须走本地代理**（见 §8 环境）。`git push` 会把进度写到 stderr，**PowerShell 会把它显示成红色错误，但推送其实是成功的** —— 用 `git ls-remote origin main` 确认。

Release 必须上传（AGENTS.md §2.4）：

```
DeepSeek-Harness-GUI-Setup-<version>.exe
DeepSeek-Harness-GUI-Setup-<version>.exe.blockmap
DeepSeekHarnessGUI-portable.exe
latest.yml          ← 少了这个，客户端检测不到更新
```

`DeepSeekHarnessGUI-portable.exe` 文件名不带版本号，重新构建会**静默覆盖**旧的便携版，需要留存就先改名备份。

---

## 5. 装机后要验证什么（本次实测记录，供下次对照）

用户装完新版本后，按这套清单核对：

| # | 检查项 | 命令 / 位置 | `0.2.0-rc.1` 实测值 |
|---|---|---|---|
| 1 | 主程序版本 | `(Get-Item "$env:ProgramFiles\DeepSeek Harness GUI\DeepSeek Harness GUI.exe").VersionInfo` | `0.2.0-rc.1` |
| 2 | 注册表版本 | `HKLM:\SOFTWARE\...\Uninstall\*` 里 `DisplayName` | `DeepSeek Harness GUI 0.2.0-rc.1` |
| 3 | 内置 dsh | `resources\dsh\node_modules\@deepseek-ai\dsh\package.json` | `0.2.0-rc.1` |
| 4 | 服务存活 | 从 `%APPDATA%\deepseek-harness-gui\dsh-server.log` 抓最后的 `dsh web: <url>`，用该 URL 请求 | HTTP 200，含 `__DSH_BOOT__` |
| 5 | 鉴权 | 请求 `http://127.0.0.1:3080/` | HTTP **401**（正常，不是故障） |
| 6 | profile junction | `Get-ChildItem "$env:USERPROFILE\.dsh\profiles" -Recurse -Force -Directory \| ? LinkType` | 608 个，全部指向 `C:\Program Files\DeepSeek Harness GUI\resources\dsh\...` |
| 7 | 数据完整性 | `~\.dsh\sessions`、`attachments`、`.credentials.yaml` | 19 / 77 / 存在（含 35 字符 `sk-` Key） |

### 5.1 ⚠️ `settings.yaml` 会"消失"——这是正常迁移，不是故障

`0.1.6` → `0.2.0` 之间 dsh 改了配置存储机制。升级后 `~\.dsh\settings.yaml` **会被重命名为 `settings.yaml.imported`**，内容迁到 `~\.dsh\storages\`。

**下次升级时如果看到 `settings.yaml` 不见了，不要当成 bug，也不要从备份里恢复覆盖** —— 先确认：

```powershell
Get-Item "$env:USERPROFILE\.dsh\settings.yaml.imported"    # 旧配置，保留着
Get-ChildItem "$env:USERPROFILE\.dsh\storages"             # 新存储
Get-Content "$env:USERPROFILE\.dsh\settings.yaml.imported" # 内容应完整（agent-default-model 等）
```

同理，`storages\session_projcache\` 是 0.2.0 新增的会话缓存层，别当垃圾删。

---

## 6. 🔴 升级前必须做的事（不可逆风险）

**跨大版本（如 0.1.6 → 0.2.0）时，dsh 会迁移会话格式，且不支持降级。**

装机前先备份 `~\.dsh` 的**数据部分**：

```powershell
$src = "$env:USERPROFILE\.dsh"
$dst = "C:\dsh-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $dst -Force | Out-Null
foreach ($i in 'sessions','storages','cache','llm-deepseek','attachments') {
  if (Test-Path "$src\$i") { Copy-Item "$src\$i" -Destination $dst -Recurse -Force }
}
foreach ($f in 'settings.yaml','.credentials.yaml','.anonymous-user-id') {
  if (Test-Path "$src\$f") { Copy-Item "$src\$f" -Destination $dst -Force }
}
```

**⚠️ 绝对不要 `Copy-Item "$src" -Destination $dst -Recurse` 整个目录** —— `profiles\` 里是 608 个 junction，递归复制会跟到安装目录去（轻则备份膨胀、重则报错）。`profiles\` 本来也不需要备份，新版本启动时会自动重建。

`0.2.0-rc.1` 升级时实测备份体积 **361.5 MB / 136 文件**（其中 sessions 仅 20.6 MB，attachments 占 338.6 MB），备份里 junction 数量应为 **0**。

---

## 7. 待办：pnpm 体积瘦身（可选优化，收益大）

**现象**：打包载荷里 `resources\pnpm` 占 **400 MB**（总载荷 841.9 MB 的近一半），比 dsh 本体的 354.8 MB 还大。

**原因**：`pnpm` 通过 `@pnpm/exe` 分发，把**完整的 Node 运行时塞进了每一个可执行文件**：

```
49.5 MB  pnpm       49.5 MB  pnpm.exe
49.5 MB  pn         49.5 MB  pn.exe
49.5 MB  pnx        49.5 MB  pnx.exe
49.5 MB  pnpx       49.5 MB  pnpx.exe
────────────────────────────────
小计约 396 MB，占该目录 99%
```

**改法**：在 `scripts/prepare-resources.mjs` 里，写 pnpm shim 的那段（约 L163-176）之后，删除 `pnpm-core` 下除 `pnpm.exe` 之外的命令二进制（`pn`、`pnx`、`pnpx` 及其 `.exe`）。现有 `pnpm.cmd` 只调用 `pnpm-core\pnpm.exe`，所以理论上安全。

**预期收益**：安装包 `314.89 MB → 约 80 MB`，载荷 `841.9 MB → 约 545 MB`，安装耗时明显缩短。

**⚠️ 必须实测才算验证过**：改完要在一个会话里**实际触发一次插件安装**（设置 → 插件 → 装一个社区插件），确认 dsh 没有调用 `pnpx`/`pnx`。只跑 `--version` 不足以证明。

**为什么没做**：`0.2.0-rc.1` 发版时优先保证"能用"，瘦身属于纯优化，留到下次发版一起做。

---

## 8. 环境（2026-09-29 实测）

| 项 | 值 |
|---|---|
| 系统 | Windows 11 Pro 25H2（build 10.0.26200） |
| CPU / GPU | i9-13900K（24 核 32 线程）/ RTX 4080 16GB |
| 内存 | 64 GB |
| 磁盘 | C 盘剩余 561.7 GB（构建前） |
| Shell | **只有 Windows PowerShell 5.1，没有 `pwsh`** |
| Node / npm | v24.14.0 / 11.9.0 |
| 构建用 pnpm | `npm run prepare` 内部走 `npx -y pnpm@10`（实测 10.30.2） |
| 杀软 | Windows Defender 实时防护开启；已为本程序加了两条排除项（AGENTS.md §4） |
| git 代理 | 必须走本地代理（`http://127.0.0.1:10808`，socks5h 同端口），直连不通 |

两个容易浪费时间的坑：

- **PS 5.1 的 `Start-Process -ArgumentList` 不给含空格的参数加引号**：`C:\Program Files\...` 会被截成 `C:\Program`，报 `Cannot find module 'C:\Program'`。写法：`` "`"$bin`"" ``（AGENTS.md §3.2）
- **不要用宽泛的 `Where-Object { $_.CommandLine -match '<脆弱关键词>' }` 去 kill node 进程**：实测曾用 `-match 'smoke'` 试图清理测试进程，结果**误杀了打包任务自己的进程**（`subprocess-local: Windows Job runner exited with exit code 4294967295`）。清理进程时先 `Get-CimInstance ... | Select ProcessId,CommandLine` **打印确认**，再按**精确 PID** kill。

---

## 9. 禁止事项（精简版，完整论述见 AGENTS.md）

1. **不要从复制出来的目录启动 dsh** —— 会把 `~/.dsh/profiles` 的 608 个 junction 重指过去，删掉副本后装机版起不来（真实事故，AGENTS.md §6）
2. **不要用同一个版本号重新发布** —— 谁都收不到（§3）
3. **不要 `git add release/ resources/`** —— 已在 `.gitignore` 里，别强加
4. **不要在 GUI 正在运行时覆盖安装它** —— 那个进程很可能正托管着用户正在用的会话界面
5. **不要静默修改用户的杀软配置** —— 安装器里那个勾选是"显式同意"，别再偷偷加强制逻辑
6. **不要把 Defender 排除项提前到解压之前** —— 实测收益接近零，还会造成"取消安装却已改配置"的副作用（AGENTS.md §5）
7. **不要因为 `settings.yaml` 不见了就去"修复"它** —— 那是 0.2.0 的正常迁移（§5.1）

---

## 10. Release 说明模板（可直接粘贴）

```markdown
跟随上游 `@deepseek-ai/dsh` 升级至 **<version>**。

DeepSeek Harness（dsh）的 Windows 桌面封装版：内嵌 Node.js v24 + dsh <version> 完整依赖 + pnpm，
无需安装任何环境、无需打开命令行，安装后填入 DeepSeek API Key 即可使用。

## 本版变化

- 内置 dsh 由 <旧版本> 升级至 <新版本>
- （如有）延续修复：……

上游主要变化：
- ……

## 下载

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `DeepSeek-Harness-GUI-Setup-<version>.exe` | <大小> MB | 安装版（推荐，支持自动更新） |
| `DeepSeekHarnessGUI-portable.exe` | <大小> MB | 绿色便携版，双击即用（无自动更新，也没有「启动加速」页） |

校验值：

| 文件 | MD5 | SHA256 |
| --- | --- | --- |
| `DeepSeek-Harness-GUI-Setup-<version>.exe` | `<md5>` | `<sha256>` |
| `DeepSeekHarnessGUI-portable.exe` | `<md5>` | `<sha256>` |

Windows 下校验（命令行直接粘贴）：

`certutil -hashfile DeepSeek-Harness-GUI-Setup-<version>.exe SHA256`

> `latest.yml` 和 `.blockmap` 是自动更新清单文件，不用下载。

## 使用说明

1. 双击桌面图标启动，跟随引导页进入 **Settings → Models** 填入 API Key（`sk-...`）
2. 点击 **Choose workspace** 选择项目目录，开始会话

## 注意

- 跨大版本升级时 dsh 会迁移会话格式且**不可降级**，升级前建议备份 `~\.dsh`
- Windows SmartScreen 可能提示「未知发布者」（开源项目无付费签名），点「更多信息 → 仍要运行」即可
- 安装需解压约 <N> MB 载荷，约 1~2 分钟，进度条可能长时间不动，请勿取消
- 上游 dsh 仍为开发者预览版，遇到问题请到 Issues 反馈，并附上 `%TEMP%\deepseek-harness-gui-boot.log`
```
