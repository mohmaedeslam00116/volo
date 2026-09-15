// Narrow typed bridge. Renderer gets invoke-only access; events flow back.
// The VoloApi interface is the single source of truth for the IPC contract:
// renderer code type-checks against exactly what main implements.
import { contextBridge, ipcRenderer } from "electron";

export interface SessionListItem {
  sessionId: string;
  title?: string;
  checkpointRunCount?: number;
}

export interface TranscriptBlockBase {
  type: string;
}

export type TranscriptBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; name: string; text: string; isError: boolean };

export interface TranscriptMessage {
  role: "user" | "assistant";
  blocks: TranscriptBlock[];
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
  history(sessionId: string): Promise<{ transcript: TranscriptMessage[] }>;
  resume(sessionId: string, checkpointRunCount: number): Promise<{ sessionId: string }>;
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
  history: (sessionId) => ipcRenderer.invoke("volo:history", { sessionId }),
  resume: (sessionId, checkpointRunCount) =>
    ipcRenderer.invoke("volo:resume", { sessionId, checkpointRunCount }),
  setKey: (providerId, apiKey) => ipcRenderer.invoke("volo:set-key", { providerId, apiKey }),
  keyStatus: () => ipcRenderer.invoke("volo:key-status"),
  clearKey: () => ipcRenderer.invoke("volo:clear-key"),
  usage: (sessionId) => ipcRenderer.invoke("volo:usage", { sessionId }),
  win: (action) => ipcRenderer.invoke("volo:win", action),
  onEvent: (fn) => ipcRenderer.on("volo:event", (_e, msg: VoloEventMessage) => fn(msg)),
};

contextBridge.exposeInMainWorld("volo", api);
