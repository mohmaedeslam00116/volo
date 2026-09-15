// Volo main process: ClineCore (local) + approval tiers + window controls.
// ClineCore lives ONLY here. Renderer talks via the narrow preload bridge.
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import { ClineCore } from "@cline/sdk";

const TIER_AUTO = new Set(["read_files", "search_codebase", "search_files", "fetch_web", "list_files"]);
const TIER_DENY = [/rm\s+-rf/i, /mkfs/i, /diskpart/i, /Invoke-WebRequest.*\|\s*iex/i, /curl.*\|\s*(sh|bash)/i];

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
        for (const rx of TIER_DENY) {
          if (rx.test(tool) || rx.test(input)) {
            send("approval", { tool, decision: "hard-deny" });
            return { approved: false };
          }
        }
        if (TIER_AUTO.has(tool)) {
          send("approval", { tool, decision: "auto-allow" });
          return { approved: true };
        }
        send("approval", { tool, decision: "asking" });
        const { response } = await dialog.showMessageBox(win, {
          type: "question",
          buttons: ["Allow", "Deny"],
          defaultId: 1,
          cancelId: 1,
          title: "Volo approval",
          message: `Allow tool: ${tool}?`,
          detail: input,
        });
        const approved = response === 0;
        send("approval", { tool, decision: approved ? "allowed" : "denied" });
        return { approved };
      },
    },
  });
  cline.subscribe((e) => send("session", e));
  return cline;
}

ipcMain.handle("volo:start", async (_ev, { prompt }) => {
  const clean = validPrompt(prompt);
  if (!clean) throw new Error("prompt must be 1-4000 characters");
  const c = await ensureCore();
  const session = await c.start({
    prompt: clean,
    config: {
      providerId: process.env.VOLO_PROVIDER ?? "anthropic",
      modelId: process.env.VOLO_MODEL ?? "claude-sonnet-4-6",
      apiKey: process.env.VOLO_API_KEY,
      cwd: process.env.VOLO_CWD ?? process.cwd(),
      workspaceRoot: process.env.VOLO_CWD ?? process.cwd(),
      enableTools: true,
    },
    toolPolicies: {
      read_files: { autoApprove: true },
      search_codebase: { autoApprove: true },
      run_commands: { autoApprove: false },
      editor: { autoApprove: false },
    },
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
