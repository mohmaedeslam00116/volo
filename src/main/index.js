// Volo main process: ClineCore (local) + approval tiers + window controls.
// ClineCore lives ONLY here. Renderer talks via the narrow preload bridge.
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { ClineCore } from "@cline/sdk";
import { validateKeyInput, decideSave, secretsPath, parseStored } from "./keyStore.js";
import { summarizeUsage } from "../shared/usage.js";
import { decideApproval, buildToolPolicies, APPROVAL_TIMEOUT_MS } from "./approvals.js";

function askWithTimeout(tool, input) {
  return Promise.race([
    dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Allow", "Deny"],
      defaultId: 1,
      cancelId: 1,
      title: "Volo approval",
      message: `Allow tool: ${tool}?`,
      detail: input,
    }),
    new Promise((resolve) => setTimeout(() => resolve({ response: 1, timedOut: true }), APPROVAL_TIMEOUT_MS)),
  ]);
}

let win = null;
let cline = null;

function send(evt, payload) {
  if (win && !win.isDestroyed()) win.webContents.send("volo:event", { evt, payload });
}

function validPrompt(p) {
  return typeof p === "string" && p.trim().length > 0 && p.length <= 4000 ? p.trim() : null;
}

async function ensureCore() {
  if (cline) return cline;
  cline = await ClineCore.create({
    clientName: "volo",
    backendMode: "local",
    capabilities: {
      requestToolApproval: async (req) => {
        const tool = req.toolName ?? "unknown-tool";
        const input = JSON.stringify(req.input ?? {}).slice(0, 500);
        const verdict = decideApproval(tool, input);
        if (verdict === "deny") {
          send("approval", { tool, decision: "hard-deny" });
          return { approved: false };
        }
        if (verdict === "allow") {
          send("approval", { tool, decision: "auto-allow" });
          return { approved: true };
        }
        send("approval", { tool, decision: "asking" });
        const { response, timedOut } = await askWithTimeout(tool, input);
        const approved = response === 0 && !timedOut;
        send("approval", { tool, decision: timedOut ? "timeout-deny" : approved ? "allowed" : "denied" });
        return { approved };
      },
    },
  });
  cline.subscribe((e) => send("session", e));
  return cline;
}

function storedPath() {
  return secretsPath(app.getPath("userData"));
}

/** Returns { available, providerId, apiKey }. Key material never leaves main. */
function loadStoredKey() {
  if (!safeStorage.isEncryptionAvailable()) return { available: false };
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

ipcMain.handle("volo:set-key", async (_ev, { providerId, apiKey }) => {
  const v = validateKeyInput({ providerId, apiKey });
  if (!v.ok) throw new Error(`invalid-key:${v.error}`);
  if (!decideSave(safeStorage.isEncryptionAvailable()))
    throw new Error("encryption-unavailable");
  const enc = safeStorage.encryptString(apiKey).toString("hex");
  writeFileSync(storedPath(), JSON.stringify({ providerId, enc, updatedAt: new Date().toISOString() }), { mode: 0o600 });
  return { ok: true, providerId };
});

ipcMain.handle("volo:key-status", async () => {
  const s = loadStoredKey();
  return { encryptionAvailable: s.available, hasKey: !!s.apiKey, providerId: s.providerId };
});

ipcMain.handle("volo:clear-key", async () => {
  try { rmSync(storedPath(), { force: true }); } catch { /* already gone */ }
  return { ok: true };
});

ipcMain.handle("volo:start", async (_ev, { prompt }) => {
  const clean = validPrompt(prompt);
  if (!clean) throw new Error("prompt must be 1-4000 characters");
  const c = await ensureCore();
  const stored = loadStoredKey();
  const session = await c.start({
    prompt: clean,
    config: {
      providerId: stored.providerId ?? process.env.VOLO_PROVIDER ?? "anthropic",
      modelId: process.env.VOLO_MODEL ?? "claude-sonnet-4-6",
      apiKey: stored.apiKey ?? process.env.VOLO_API_KEY,
      cwd: process.env.VOLO_CWD ?? process.cwd(),
      workspaceRoot: process.env.VOLO_CWD ?? process.cwd(),
      enableTools: true,
    },
    toolPolicies: buildToolPolicies(),
  });
  return { sessionId: session.sessionId };
});

ipcMain.handle("volo:send", async (_ev, { sessionId, prompt }) => {
  const clean = validPrompt(prompt);
  if (!clean || typeof sessionId !== "string") throw new Error("bad send args");
  const c = await ensureCore();
  await c.send(sessionId, { type: "user_message", prompt: clean });
  return { ok: true };
});

ipcMain.handle("volo:abort", async (_ev, { sessionId }) => {
  if (typeof sessionId !== "string") throw new Error("bad abort args");
  const c = await ensureCore();
  await c.abort(sessionId);
  return { ok: true };
});

ipcMain.handle("volo:list", async () => {
  const c = await ensureCore();
  return { sessions: await c.list() };
});

ipcMain.handle("volo:usage", async (_ev, { sessionId }) => {
  if (typeof sessionId !== "string" || !sessionId) throw new Error("bad usage args");
  const c = await ensureCore();
  return summarizeUsage(await c.getAccumulatedUsage(sessionId));
});

ipcMain.handle("volo:win", (_ev, action) => {
  if (!win) return { ok: false };
  if (action === "min") win.minimize();
  else if (action === "max") (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === "close") win.close();
  return { ok: true };
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    frame: false,
    backgroundColor: "#0c0c0e",
    webPreferences: { preload: join(__dirname, "../preload/index.cjs") },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { cline?.dispose?.(); app.quit(); });
