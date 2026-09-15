// Preload (CJS for max Electron compat): narrow typed bridge only.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("volo", {
  start: (prompt) => ipcRenderer.invoke("volo:start", { prompt }),
  send: (sessionId, prompt) => ipcRenderer.invoke("volo:send", { sessionId, prompt }),
  abort: (sessionId) => ipcRenderer.invoke("volo:abort", { sessionId }),
  onEvent: (fn) => ipcRenderer.on("volo:event", (_e, msg) => fn(msg)),
});
