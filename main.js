// --- boot diagnostics (writes to %TEMP%\deepseek-harness-gui-boot.log) ---
const _fs = require('fs');
const _path = require('path');
const _bootLog = _path.join(process.env.TEMP || process.cwd(), 'deepseek-harness-gui-boot.log');
function _diag(msg) {
  try { _fs.appendFileSync(_bootLog, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}
process.on('uncaughtException', (e) => _diag(`UNCAUGHT: ${e.stack}`));
process.on('unhandledRejection', (e) => _diag(`UNHANDLED: ${e && e.stack || e}`));
_diag(`main.js loaded, electron=${process.versions.electron}, execPath=${process.execPath}`);
// --- end diagnostics ---

const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DEFAULT_PORT = 3080;
const BOOT_TIMEOUT_MS = 90000;
// marker present in the dsh web UI html, used to tell a real dsh server
// apart from any other program that happens to occupy the port
const DSH_MARKER = '__DSH_BOOT__';

// In packaged app, runtimes live in process.resourcesPath; in dev, in ./resources
const RESOURCES = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, 'resources');

const NODE_EXE = path.join(RESOURCES, 'node', 'node.exe');
const DSH_BIN = path.join(RESOURCES, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const PNPM_DIR = path.join(RESOURCES, 'pnpm');
const DSH_HOME = path.join(app.getPath('home'), '.dsh');

const logDir = app.getPath('userData');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'dsh-server.log');

let dshProcess = null;
let mainWindow = null;
let quitting = false;
let dshUrl = null;           // resolved base URL of the dsh server
let stdoutUrl = null;        // URL parsed from dsh stdout ("dsh web: http://...")
let isFirstRun = false;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

function setStage(text) {
  _diag(`stage: ${text}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('boot-status', text);
  }
}

// Probe whether `url` is served by a real dsh server (marker in the html).
function probeDsh(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) req.destroy();
      });
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 500 && body.includes(DSH_MARKER)));
      res.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// TCP-connectable means *something* occupies the port.
function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.setTimeout(1500, () => { sock.destroy(); resolve(false); });
  });
}

function startDsh(port) {
  if (!fs.existsSync(NODE_EXE)) throw new Error(`node.exe not found: ${NODE_EXE}`);
  if (!fs.existsSync(DSH_BIN)) throw new Error(`dsh bin not found: ${DSH_BIN}`);

  const env = {
    ...process.env,
    PATH: `${path.dirname(NODE_EXE)};${PNPM_DIR};${process.env.PATH || ''}`,
    // keep dsh data in the standard user profile location (~/.dsh)
  };

  // port 0 = let dsh/OS pick a free port; the actual URL is then taken
  // from the stdout line "dsh web: http://127.0.0.1:<port>"
  const args = [DSH_BIN, 'web', '--port', String(port)];
  log(`spawning: ${NODE_EXE} ${args.join(' ')}`);
  dshProcess = spawn(NODE_EXE, args, {
    cwd: app.getPath('home'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  dshProcess.stdout.on('data', (d) => {
    const text = d.toString();
    log(`[stdout] ${text.trimEnd()}`);
    const m = text.match(/dsh web: (https?:\/\/\S+)/);
    if (m) stdoutUrl = m[1].replace(/\/$/, '');
  });
  dshProcess.stderr.on('data', (d) => log(`[stderr] ${d.toString().trimEnd()}`));
  dshProcess.on('exit', (code, signal) => {
    log(`dsh exited code=${code} signal=${signal}`);
    dshProcess = null;
    if (!quitting && mainWindow) showError(`dsh 服务意外退出 (code=${code})`);
  });
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = stdoutUrl || dshUrl;
    if (url && await probeDsh(url)) {
      dshUrl = url;
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function killDsh() {
  if (dshProcess && dshProcess.pid) {
    try {
      execSync(`taskkill /pid ${dshProcess.pid} /T /F`, { stdio: 'ignore' });
      log(`killed dsh process tree (pid=${dshProcess.pid})`);
    } catch (e) {
      log(`taskkill failed: ${e.message}`);
    }
    dshProcess = null;
  }
}

function showError(message) {
  if (!mainWindow) return;
  const errPage = path.join(__dirname, 'error.html');
  mainWindow.loadFile(errPage, { query: { msg: message, log: logFile } });
}

function loadUi() {
  if (!mainWindow) return;
  setStage('正在加载界面…');
  if (isFirstRun) {
    // first boot: brief onboarding (configure API key) before entering the UI
    mainWindow.loadFile(path.join(__dirname, 'first-run.html'), { query: { url: dshUrl } });
    _diag('first-run page shown');
  } else {
    mainWindow.loadURL(dshUrl);
    _diag('UI loaded');
  }
}

// --- auto update (GitHub Releases, NSIS installs only) ---
function setupAutoUpdater() {
  if (!app.isPackaged) {
    _diag('auto-updater skipped (dev mode)');
    return;
  }
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    _diag('auto-updater skipped (portable build)');
    return;
  }
  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (e) {
    _diag(`auto-updater unavailable: ${e.message}`);
    return;
  }
  // Our version tracks the upstream dsh version (e.g. 0.1.0-rc.6), so
  // prerelease releases must be considered. Do NOT pin autoUpdater.channel:
  // electron-updater derives the match channel from the app version's
  // prerelease tag ("rc") and the channel-file name from publish.channel
  // ("latest" → latest.yml); pinning the channel would break rc-tag matching.
  autoUpdater.allowPrerelease = true;
  autoUpdater.autoDownload = true;
  autoUpdater.logger = {
    info: (m) => _diag(`[updater] ${m}`),
    warn: (m) => _diag(`[updater][warn] ${m}`),
    error: (m) => _diag(`[updater][error] ${m}`),
    debug: () => {},
  };

  autoUpdater.on('update-available', (info) => {
    _diag(`[updater] update available: ${info.version}`);
  });
  autoUpdater.on('update-not-available', () => {
    _diag('[updater] already up to date');
  });
  autoUpdater.on('error', (e) => {
    _diag(`[updater] error: ${e && e.message || e}`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    _diag(`[updater] downloaded: ${info.version}`);
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `新版本 ${info.version} 已下载完成`,
      detail: '重启应用以完成更新（dsh 服务会随应用一起重启）。',
      buttons: ['立即重启更新', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        quitting = true;
        killDsh();
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdates().catch((e) => _diag(`[updater] check failed: ${e.message}`));
}
// --- end auto update ---

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: 'DeepSeek Harness GUI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('http://127.0.0.1')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { _diag('window closed'); mainWindow = null; });

  mainWindow.webContents.on('did-finish-load', () => _diag(`did-finish-load: ${mainWindow && mainWindow.webContents.getURL()}`));
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => _diag(`did-fail-load: ${code} ${desc} ${url}`));
  mainWindow.webContents.on('render-process-gone', (e, details) => _diag(`render-process-gone: ${JSON.stringify(details)}`));

  await mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  _diag('loading page shown');

  isFirstRun = !fs.existsSync(DSH_HOME);

  // 1. already-running dsh on the default port → attach directly
  setStage('正在检测本地 dsh 服务…');
  dshUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  if (await probeDsh(dshUrl)) {
    log('default port already served by dsh, attaching without spawning');
    _diag('attaching to existing dsh on 3080');
    loadUi();
    return;
  }

  // 2. port occupied by something else → let the OS pick a free port
  let port = DEFAULT_PORT;
  if (await portInUse(DEFAULT_PORT)) {
    port = 0;
    _diag('port 3080 occupied by a non-dsh program, using a dynamic port');
  }

  try {
    setStage('正在启动内置 dsh 服务…');
    startDsh(port);
    _diag(`dsh spawned (port=${port})`);
  } catch (e) {
    showError(e.message);
    return;
  }

  setStage('等待 dsh 服务就绪…');
  const up = await waitForServer(BOOT_TIMEOUT_MS);
  _diag(`server up=${up} url=${dshUrl || stdoutUrl}`);
  if (up && mainWindow) {
    loadUi();
  } else if (mainWindow) {
    showError(`dsh 服务在 ${BOOT_TIMEOUT_MS / 1000} 秒内未就绪`);
  }
}

const gotLock = app.requestSingleInstanceLock();
_diag(`singleInstanceLock=${gotLock}`);
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    _diag('app ready, creating window');
    return createWindow();
  }).then(() => {
    setupAutoUpdater();
  }).catch((e) => _diag(`createWindow failed: ${e.stack}`));

  app.on('window-all-closed', () => {
    _diag('window-all-closed, quitting');
    quitting = true;
    killDsh();
    app.quit();
  });

  app.on('will-quit', () => _diag('will-quit'));

  app.on('before-quit', () => {
    quitting = true;
    killDsh();
  });
}
