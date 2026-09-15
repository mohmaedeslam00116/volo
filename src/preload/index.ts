// Narrow typed bridge. Renderer gets invoke-only access; events flow back.
// The VoloApi interface is the single source of truth for the IPC contract:
// renderer code type-checks against exactly what main implements.
import { contextBridge, ipcRenderer } from "electron";

export interface SessionListItem {
  sessionId: string;
  title?: string;
  status?: string;
}

export interface VoloEventMessage {
  evt: "approval" | "session";
  payload: unknown;
}

export interface ModelSelectionPayload {
  provider: string;
  model: string;
}

export interface VoloApi {
  start(prompt: string, model?: ModelSelectionPayload): Promise<{ sessionId: string }>;
  send(sessionId: string, prompt: string): Promise<{ ok: true }>;
  stop(sessionId: string): Promise<{ ok: true }>;
  list(): Promise<{ sessions: SessionListItem[] }>;
  setKey(providerId: string, apiKey: string): Promise<{ ok: true; providerId: string }>;
  keyStatus(): Promise<{ encryptionAvailable: boolean; hasKey: boolean; providerId: string | null }>;
  clearKey(): Promise<{ ok: true }>;
  usage(sessionId: string): Promise<{ input: number; output: number; cost: number }>;
  win(action: "min" | "max" | "close"): Promise<{ ok: boolean }>;
  onEvent(fn: (msg: VoloEventMessage) => void): void;
}

const api: VoloApi = {
  start: (prompt, model) => ipcRenderer.invoke("volo:start", { prompt, model }),
  send: (sessionId, prompt) => ipcRenderer.invoke("volo:send", { sessionId, prompt }),
  stop: (sessionId) => ipcRenderer.invoke("volo:stop", { sessionId }),
  list: () => ipcRenderer.invoke("volo:list"),
  setKey: (providerId, apiKey) => ipcRenderer.invoke("volo:set-key", { providerId, apiKey }),
  keyStatus: () => ipcRenderer.invoke("volo:key-status"),
  clearKey: () => ipcRenderer.invoke("volo:clear-key"),
  usage: (sessionId) => ipcRenderer.invoke("volo:usage", { sessionId }),
  win: (action) => ipcRenderer.invoke("volo:win", action),
  onEvent: (fn) => ipcRenderer.on("volo:event", (_e, msg: VoloEventMessage) => fn(msg)),
};

contextBridge.exposeInMainWorld("volo", api);
