// Volo prototype: minimal Electron shell around @cline/sdk (local backend).
// - ClineCore lives ONLY in main. Renderer talks via IPC.
// - Approvals: reads auto-allow, writes/commands ask via native dialog.
// - Keys: env vars only (prototype). Never sent to renderer.
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ClineCore } from "@cline/sdk";

const TIER_AUTO = new Set(["read_files", "search_codebase", "search_files", "fetch_web", "list_files"]);
const TIER_DENY = [/rm\s+-rf/i, /mkfs/i, /diskpart/i, /Invoke-WebRequest.*\|\s*iex/i, /curl.*\|\s*(sh|bash)/i];

let win = null;
let cline = null;

function send(evt, payload) {
  if (win && !win.isDestroyed()) win.webContents.send("volo:event", { evt, payload });
}

async function ensureCore() {
  if (cline) return cline;
  cline = await ClineCore.create({
    clientName: "volo-prototype",
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
  const c = await ensureCore();
  const session = await c.start({
    prompt,
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
  const c = await ensureCore();
  await c.send(sessionId, { type: "user_message", prompt });
  return { ok: true };
});

ipcMain.handle("volo:abort", async (_ev, { sessionId }) => {
  const c = await ensureCore();
  await c.abort(sessionId);
  return { ok: true };
});

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1000, height: 700,
    webPreferences: { preload: new URL("./preload.cjs", import.meta.url).pathname.replace(/^\//, "") },
  });
  win.loadFile("renderer/index.html");
});
app.on("window-all-closed", () => { cline?.dispose?.(); app.quit(); });
