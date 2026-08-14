const { contextBridge, ipcRenderer } = require('electron');

// Minimal bridge: lets the loading page receive boot stage text from the
// main process. No other surface is exposed to the dsh web UI.
contextBridge.exposeInMainWorld('bootStatus', {
  on: (cb) => ipcRenderer.on('boot-status', (_event, text) => cb(text)),
});
