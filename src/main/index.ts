// Volo main process: ClineCore (local) + approval tiers + window controls.
// ClineCore lives ONLY here. Renderer talks via the narrow preload bridge.
// SDK contracts verified against @cline/sdk 0.0.83 (wayfinder research ticket):
//  - send = runTurn({ sessionId, prompt }) — flat, no {type:"user_message"} wrapper
//  - stop ends the session; abort only interrupts the in-flight tool
//  - provider IDs: anthropic | openai-native | gemini (never "openai"/"google")
import { randomUUID } from "node:crypto";
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import electronUpdater from "electron-updater";
import { join } from "node:path";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { z } from "zod";
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
import { mapTranscript } from "../shared/transcript.ts";
import { settingsPath, parseSettings, serializeSettings, type ModelSettings } from "./settingsStore.ts";
import { modelsFor } from "../shared/providers.ts";
import {
  startPayloadSchema,
  sendPayloadSchema,
  sessionIdPayloadSchema,
  setKeyPayloadSchema,
  approvalResponseSchema,
} from "../shared/schemas.ts";
import {
  decideApproval,
  buildToolPolicies,
  USER_REJECTED_TOOL_REASON,
  APPROVAL_TIMEOUT_MS,
} from "./approvals.ts";

let win: BrowserWindow | null = null;
let cline: ClineCore | null = null;

// ---- Auto-update (electron-updater, GitHub Releases provider) ------------
// Zero-cost honesty: the only network traffic is the standard GitHub Releases
// check (documented in the README). Failure is silent and never blocks the app.
const { autoUpdater } = electronUpdater;
let updateState: "idle" | "available" | "none" = "idle";

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", () => {
    updateState = "available";
    send("update", { state: "available" });
  });
  autoUpdater.on("update-not-available", () => {
    updateState = "none";
  });
  autoUpdater.on("error", () => {
    /* silent: offline / private repo / rate limit must never surface as noise */
  });
  // In dev / unpackaged runs electron-updater would throw; guard by env.
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {});
}

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

// ---- Approval round-trip ------------------------------------------------
// Ask-tier tools pause here and surface the DESIGN.md signature dialog in the
// renderer over IPC. Fallbacks: the window is minimized → the old native OS
// dialog; no window at all → deny. Timeout → auto-deny. Deny is always the
// safe default.
const pendingApprovals = new Map<string, (approved: boolean) => void>();

function nativeApproval(tool: string, input: string): Promise<boolean> {
  return dialog
    .showMessageBox(win!, {
      type: "question",
      buttons: ["Allow", "Deny"],
      defaultId: 1,
      cancelId: 1,
      title: "Volo approval",
      message: `Allow tool: ${tool}?`,
      detail: input.slice(0, 500),
    })
    .then((r) => r.response === 0 && !r.checkboxChecked);
}

async function askForApproval(tool: string, input: string): Promise<{ approved: boolean; timedOut: boolean }> {
  const id = randomUUID();
  let timedOut = false;
  let settle!: (v: boolean) => void;
  const answer = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  pendingApprovals.set(id, settle);

  if (win && !win.isDestroyed() && !win.isMinimized()) {
    // Primary path: renderer-hosted signature dialog.
    send("approval-request", { id, tool, input, timeoutMs: APPROVAL_TIMEOUT_MS });
  } else if (win && !win.isDestroyed()) {
    // Fallback: minimized to a native OS dialog so the gate is never invisible.
    nativeApproval(tool, input).then(settle);
  } else {
    settle(false);
  }

  const timer = setTimeout(() => {
    timedOut = true;
    settle(false);
  }, APPROVAL_TIMEOUT_MS);
  const approved = await answer;
  clearTimeout(timer);
  pendingApprovals.delete(id);
  return { approved, timedOut };
}

async function ensureCore(): Promise<ClineCore> {
  if (cline) return cline;
  cline = await ClineCore.create({
    clientName: "volo",
    backendMode: "local",
    capabilities: {
      requestToolApproval: async (req: ToolApprovalRequest): Promise<ToolApprovalResult> => {
        const tool = req.toolName ?? "unknown-tool";
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
        const pretty = JSON.stringify(req.input ?? {}, null, 2).slice(0, 2000);
        const { approved, timedOut } = await askForApproval(tool, pretty);
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

function modelSettingsPath(): string {
  return settingsPath(app.getPath("userData"));
}

/** Stored model preference or null. Invalid records read as absent. */
function loadModelSettings(): ModelSettings | null {
  try {
    const raw = readFileSync(modelSettingsPath(), "utf8");
    return parseSettings(raw, [...modelsFor("anthropic"), ...modelsFor("openai-native"), ...modelsFor("gemini")]);
  } catch {
    return null;
  }
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

ipcMain.handle("volo:get-model", async () => {
  return loadModelSettings();
});

ipcMain.handle("volo:set-model", async (_ev, payload: unknown) => {
  const parsed = parseIpc(
    z.object({ provider: z.string(), model: z.string().min(1) }),
    payload,
  );
  if (!parsed) throw new Error("bad model args");
  const providerId = asProviderId(parsed.provider);
  if (!providerId) throw new Error("unknown-provider");
  if (!modelsFor(providerId).includes(parsed.model)) throw new Error("unknown-model");
  const s: ModelSettings = { providerId, modelId: parsed.model };
  writeFileSync(modelSettingsPath(), serializeSettings(s), { mode: 0o600 });
  return { ok: true };
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
    const savedModel = loadModelSettings();
    // Precedence: live picker choice > persisted preference > stored key's
    // provider defaults > env > anthropic.
    const providerId =
      asProviderId(model?.provider) ??
      savedModel?.providerId ??
      asProviderId(stored.providerId) ??
      asProviderId(process.env.VOLO_PROVIDER) ??
      "anthropic";
    const modelId =
      (model?.provider ? model.model : undefined) ??
      savedModel?.modelId ??
      process.env.VOLO_MODEL ??
      "claude-sonnet-5";
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
        // Opt-in per SDK docs; required so sessions can be resumed later.
        checkpoint: { enabled: true },
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
  const records: SessionHistoryRecord[] = await c.list(50);
  return {
    sessions: records.map((r) => ({
      sessionId: r.sessionId,
      title: r.metadata?.title,
      checkpointRunCount: r.metadata?.checkpoint?.latest?.runCount,
    })),
  };
});

ipcMain.handle("volo:history", async (_ev, payload: unknown) => {
  const parsed = parseIpc(sessionIdPayloadSchema, payload);
  if (!parsed) throw new Error("bad history args");
  const c = await ensureCore();
  // Display-projected transcript (model-tool activity folded into tool blocks).
  return { transcript: mapTranscript(await c.readDisplayMessages(parsed.sessionId)) };
});

ipcMain.handle("volo:resume", async (_ev, payload: unknown) => {
  const parsed = parseIpc(
    sessionIdPayloadSchema.extend({ checkpointRunCount: z.number().int().positive() }),
    payload,
  );
  if (!parsed) throw new Error("bad resume args");
  const c = await ensureCore();
  const stored = loadStoredKey();
  const providerId = asProviderId(stored.providerId ?? process.env.VOLO_PROVIDER) ?? "anthropic";
  const workspaceRoot = process.env.VOLO_CWD ?? process.cwd();
  // Resume = restore-based fork (verified SDK path): history trimmed to the
  // given checkpoint, workspace files left untouched, then the fork continues.
  const result = await c.restore({
    sessionId: parsed.sessionId,
    checkpointRunCount: parsed.checkpointRunCount,
    restore: { messages: true, workspace: false },
    start: {
      config: {
        providerId,
        modelId: process.env.VOLO_MODEL ?? "claude-sonnet-5",
        apiKey: stored.apiKey ?? process.env.VOLO_API_KEY,
        cwd: workspaceRoot,
        workspaceRoot,
        enableTools: true,
        enableSpawnAgent: false,
        enableAgentTeams: false,
        systemPrompt: getClineDefaultSystemPrompt({ workspaceRoot }),
        checkpoint: { enabled: true },
      },
      toolPolicies: buildToolPolicies(),
    },
  });
  return { sessionId: result.sessionId ?? "" };
});

ipcMain.handle("volo:usage", async (_ev, payload: unknown) => {
  const parsed = parseIpc(sessionIdPayloadSchema, payload);
  if (!parsed) throw new Error("bad usage args");
  const c = await ensureCore();
  return summarizeUsage(await c.getAccumulatedUsage(parsed.sessionId));
});

ipcMain.handle("volo:respond-approval", async (_ev, payload: unknown) => {
  const parsed = parseIpc(approvalResponseSchema, payload);
  if (!parsed) return { ok: false };
  const settle = pendingApprovals.get(parsed.id);
  if (!settle) return { ok: false }; // already timed out
  settle(parsed.approved);
  return { ok: true };
});

ipcMain.handle("volo:install-update", async () => {
  if (updateState !== "available") return { ok: false };
  autoUpdater.quitAndInstall();
  return { ok: true };
});

ipcMain.handle("volo:check-update", async () => {
  if (!app.isPackaged) return { ok: false, state: "idle" };
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    /* silent */
  }
  return { ok: true, state: updateState };
});

ipcMain.handle("volo:win", (_ev, action: unknown) => {
  if (!win) return { ok: false };
  if (action === "min") win.minimize();
  else if (action === "max") win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === "close") win.close();
  return { ok: true };
});

function createWindow(): void {
  // Dev: use the source icon. Packaged: the exe carries the embedded icon.
  const iconPath = join(__dirname, "../../build/icon.ico");
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0c0c0e",
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: { preload: join(__dirname, "../preload/index.cjs") },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});
app.on("window-all-closed", () => {
  cline?.dispose?.();
  app.quit();
});
