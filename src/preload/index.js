// Narrow typed bridge. Renderer gets invoke-only access; events flow back.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("volo", {
  start: (prompt) => ipcRenderer.invoke("volo:start", { prompt }),
  send: (sessionId, prompt) => ipcRenderer.invoke("volo:send", { sessionId, prompt }),
  abort: (sessionId) => ipcRenderer.invoke("volo:abort", { sessionId }),
  list: () => ipcRenderer.invoke("volo:list"),
  setKey: (providerId, apiKey) => ipcRenderer.invoke("volo:set-key", { providerId, apiKey }),
  keyStatus: () => ipcRenderer.invoke("volo:key-status"),
  clearKey: () => ipcRenderer.invoke("volo:clear-key"),
  win: (action) => ipcRenderer.invoke("volo:win", action),
  onEvent: (fn) => ipcRenderer.on("volo:event", (_e, msg) => fn(msg)),
});
