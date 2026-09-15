// Volo main process: ClineCore (local) + approval tiers + window controls.
// ClineCore lives ONLY here. Renderer talks via the narrow preload bridge.
// SDK contracts verified against @cline/sdk 0.0.83 (wayfinder research ticket):
//  - send = runTurn({ sessionId, prompt }) — flat, no {type:"user_message"} wrapper
//  - stop ends the session; abort only interrupts the in-flight tool
//  - provider IDs: anthropic | openai-native | gemini (never "openai"/"google")
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { ClineCore, getClineDefaultSystemPrompt } from "@cline/sdk";
import type {
  CoreSessionEvent,
  SessionHistoryRecord,
  ToolApprovalRequest,
  ToolApprovalResult,
} from "@cline/sdk";
import { validateKeyInput, decideSave, secretsPath, parseStored } from "./keyStore.ts";
import { asProviderId } from "../shared/providers.ts";
import { summarizeUsage } from "../shared/usage.ts";
import {
  startPayloadSchema,
  sendPayloadSchema,
  sessionIdPayloadSchema,
  setKeyPayloadSchema,
} from "../shared/schemas.ts";
import {
  decideApproval,
  buildToolPolicies,
  USER_REJECTED_TOOL_REASON,
  APPROVAL_TIMEOUT_MS,
} from "./approvals.ts";

let win: BrowserWindow | null = null;
let cline: ClineCore | null = null;

function send(evt: string, payload: unknown): void {
  if (win && !win.isDestroyed()) win.webContents.send("volo:event", { evt, payload });
}

function validPrompt(p: unknown): string | null {
  return typeof p === "string" && p.trim().length > 0 && p.length <= 4000 ? p.trim() : null;
}

/** Parse an IPC payload against a schema; null on any mismatch (fail-closed). */
function parseIpc<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, v: unknown): T | null {
  const r = schema.safeParse(v);
  return r.success ? r.data : null;
}

async function askWithTimeout(tool: string, input: string) {
  return Promise.race([
    dialog.showMessageBox(win!, {
      type: "question",
      buttons: ["Allow", "Deny"],
      defaultId: 1,
      cancelId: 1,
      title: "Volo approval",
      message: `Allow tool: ${tool}?`,
      detail: input,
    }),
    new Promise<{ response: number; timedOut: boolean }>((resolve) =>
      setTimeout(() => resolve({ response: 1, timedOut: true }), APPROVAL_TIMEOUT_MS),
    ),
  ]);
}

async function ensureCore(): Promise<ClineCore> {
  if (cline) return cline;
  cline = await ClineCore.create({
    clientName: "volo",
    backendMode: "local",
    capabilities: {
      requestToolApproval: async (req: ToolApprovalRequest): Promise<ToolApprovalResult> => {
        const tool = req.toolName ?? "unknown-tool";
        const input = JSON.stringify(req.input ?? {}).slice(0, 500);
        const verdict = decideApproval(tool, req.input);
        if (verdict === "deny") {
          send("approval", { tool, decision: "hard-deny" });
          return { approved: false, reason: USER_REJECTED_TOOL_REASON };
        }
        if (verdict === "allow") {
          send("approval", { tool, decision: "auto-allow" });
          return { approved: true };
        }
        send("approval", { tool, decision: "asking" });
        const result = await askWithTimeout(tool, input);
        const timedOut = "timedOut" in result && result.timedOut;
        const approved = result.response === 0 && !timedOut;
        send("approval", {
          tool,
          decision: timedOut ? "timeout-deny" : approved ? "allowed" : "denied",
        });
        return approved
          ? { approved: true }
          : { approved: false, reason: USER_REJECTED_TOOL_REASON };
      },
    },
  });
  cline.subscribe((e: CoreSessionEvent) => send("session", e));
  return cline;
}

function storedPath(): string {
  return secretsPath(app.getPath("userData"));
}

/** Returns availability + providerId + apiKey. Key material never leaves main. */
function loadStoredKey(): { available: boolean; providerId: string | null; apiKey: string | null } {
  if (!safeStorage.isEncryptionAvailable())
    return { available: false, providerId: null, apiKey: null };
  try {
    const rec = parseStored(readFileSync(storedPath(), "utf8"));
    if (!rec) return { available: true, providerId: null, apiKey: null };
    const apiKey = safeStorage.decryptString(Buffer.from(rec.enc, "hex"));
    if (!apiKey) return { available: true, providerId: null, apiKey: null };
    return { available: true, providerId: rec.providerId, apiKey };
  } catch {
    return { available: true, providerId: null, apiKey: null };
  }
}

ipcMain.handle("volo:set-key", async (_ev, payload: unknown) => {
  const parsed = parseIpc(setKeyPayloadSchema, payload);
  if (!parsed) throw new Error("invalid-key:bad-payload");
  const { providerId, apiKey } = parsed;
  const v = validateKeyInput({ providerId, apiKey });
  if (!v.ok) throw new Error(`invalid-key:${v.error}`);
  if (!decideSave(safeStorage.isEncryptionAvailable())) throw new Error("encryption-unavailable");
  if (!win) throw new Error("no-window");
  const enc = safeStorage.encryptString(apiKey).toString("hex");
  writeFileSync(
    storedPath(),
    JSON.stringify({ providerId, enc, updatedAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
  return { ok: true, providerId };
});

ipcMain.handle("volo:key-status", async () => {
  const s = loadStoredKey();
  return { encryptionAvailable: s.available, hasKey: !!s.apiKey, providerId: s.providerId };
});

ipcMain.handle("volo:clear-key", async () => {
  try {
    rmSync(storedPath(), { force: true });
  } catch {
    /* already gone */
  }
  return { ok: true };
});

ipcMain.handle("volo:start", async (_ev, payload: unknown) => {
  const parsed = parseIpc(startPayloadSchema, payload);
  if (!parsed) throw new Error("prompt must be 1-4000 characters");
  const { prompt, model } = parsed;
  {
    const clean = validPrompt(prompt);
    if (!clean) throw new Error("prompt must be 1-4000 characters");
    const c = await ensureCore();
    const stored = loadStoredKey();
    // Precedence: picker choice > stored key's provider > env > anthropic.
    const providerId =
      asProviderId(model?.provider) ??
      asProviderId(stored.providerId) ??
      asProviderId(process.env.VOLO_PROVIDER) ??
      "anthropic";
    const modelId =
      typeof model?.model === "string" && model.model.length > 0
        ? model.model
        : (process.env.VOLO_MODEL ?? "claude-sonnet-5");
    const workspaceRoot = process.env.VOLO_CWD ?? process.cwd();
    const session = await c.start({
      prompt: clean,
      config: {
        providerId,
        modelId,
        apiKey: stored.apiKey ?? process.env.VOLO_API_KEY,
        cwd: workspaceRoot,
        workspaceRoot,
        enableTools: true,
        enableSpawnAgent: false,
        enableAgentTeams: false,
        systemPrompt: getClineDefaultSystemPrompt({ workspaceRoot }),
      },
      toolPolicies: buildToolPolicies(),
    });
    return { sessionId: session.sessionId };
  }
});

ipcMain.handle("volo:send", async (_ev, payload: unknown) => {
  const parsed = parseIpc(sendPayloadSchema, payload);
  if (!parsed) throw new Error("bad send args");
  const c = await ensureCore();
  // Verified contract: runTurn takes a flat { sessionId, prompt } — the old
  // {type:"user_message"} wrapper was never part of the SDK surface.
  await c.send({ sessionId: parsed.sessionId, prompt: parsed.prompt });
  return { ok: true };
});

ipcMain.handle("volo:stop", async (_ev, payload: unknown) => {
  const parsed = parseIpc(sessionIdPayloadSchema, payload);
  if (!parsed) throw new Error("bad stop args");
  const c = await ensureCore();
  // stop = end the session for good; abort only interrupts a tool.
  await c.stop(parsed.sessionId);
  return { ok: true };
});

ipcMain.handle("volo:list", async () => {
  const c = await ensureCore();
  const sessions: SessionHistoryRecord[] = await c.list(50);
  return { sessions };
});

ipcMain.handle("volo:usage", async (_ev, payload: unknown) => {
  const parsed = parseIpc(sessionIdPayloadSchema, payload);
  if (!parsed) throw new Error("bad usage args");
  const c = await ensureCore();
  return summarizeUsage(await c.getAccumulatedUsage(parsed.sessionId));
});

ipcMain.handle("volo:win", (_ev, action: unknown) => {
  if (!win) return { ok: false };
  if (action === "min") win.minimize();
  else if (action === "max") win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === "close") win.close();
  return { ok: true };
});

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0c0c0e",
    webPreferences: { preload: join(__dirname, "../preload/index.cjs") },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  cline?.dispose?.();
  app.quit();
});
