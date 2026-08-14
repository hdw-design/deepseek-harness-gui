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
const path = require('path');
const fs = require('fs');
const http = require('http');

const DSH_PORT = 3080;
const DSH_URL = `http://127.0.0.1:${DSH_PORT}`;
const BOOT_TIMEOUT_MS = 60000;

// In packaged app, runtimes live in process.resourcesPath; in dev, in ./resources
const RESOURCES = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, 'resources');

const NODE_EXE = path.join(RESOURCES, 'node', 'node.exe');
const DSH_BIN = path.join(RESOURCES, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const PNPM_DIR = path.join(RESOURCES, 'pnpm');

const logDir = app.getPath('userData');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'dsh-server.log');

let dshProcess = null;
let mainWindow = null;
let quitting = false;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

function startDsh() {
  if (!fs.existsSync(NODE_EXE)) throw new Error(`node.exe not found: ${NODE_EXE}`);
  if (!fs.existsSync(DSH_BIN)) throw new Error(`dsh bin not found: ${DSH_BIN}`);

  const env = {
    ...process.env,
    PATH: `${path.dirname(NODE_EXE)};${PNPM_DIR};${process.env.PATH || ''}`,
    // keep dsh data in the standard user profile location (~/.dsh)
  };

  log(`spawning: ${NODE_EXE} ${DSH_BIN} web`);
  dshProcess = spawn(NODE_EXE, [DSH_BIN, 'web'], {
    cwd: app.getPath('home'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  dshProcess.stdout.on('data', (d) => log(`[stdout] ${d.toString().trimEnd()}`));
  dshProcess.stderr.on('data', (d) => log(`[stderr] ${d.toString().trimEnd()}`));
  dshProcess.on('exit', (code, signal) => {
    log(`dsh exited code=${code} signal=${signal}`);
    dshProcess = null;
    if (!quitting && mainWindow) showError(`dsh 服务意外退出 (code=${code})`);
  });
}

function probeServer() {
  return new Promise((resolve) => {
    const req = http.get(DSH_URL, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probeServer()) return true;
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
  // prerelease releases must be considered, and the channel is pinned to
  // "latest" to match the publish.channel in package.json (latest.yml).
  autoUpdater.channel = 'latest';
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
    if (!url.startsWith(DSH_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { _diag('window closed'); mainWindow = null; });

  mainWindow.webContents.on('did-finish-load', () => _diag(`did-finish-load: ${mainWindow && mainWindow.webContents.getURL()}`));
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => _diag(`did-fail-load: ${code} ${desc} ${url}`));
  mainWindow.webContents.on('render-process-gone', (e, details) => _diag(`render-process-gone: ${JSON.stringify(details)}`));

  await mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  _diag('loading page shown');

  // If a dsh server is already running on 3080 (e.g. started by a previous
  // instance or manually via npx), just attach to it.
  if (await probeServer()) {
    log('port 3080 already serving, attaching without spawning');
    _diag('attaching to existing dsh on 3080');
    mainWindow.loadURL(DSH_URL);
    return;
  }

  try {
    startDsh();
    _diag('dsh spawned');
  } catch (e) {
    showError(e.message);
    return;
  }

  const up = await waitForServer(BOOT_TIMEOUT_MS);
  _diag(`server up=${up}`);
  if (up && mainWindow) {
    mainWindow.loadURL(DSH_URL);
    _diag('UI loaded');
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
