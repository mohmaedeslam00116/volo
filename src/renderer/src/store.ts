// App state (zustand): sessions, feed, approvals, status, onboarding.
// Event mapping verified against CoreSessionEvent in @cline/core 0.0.83:
// chunk carries {stream, chunk, ts}; ended carries {reason}; the old code
// treated every event as message text.
import { create } from "zustand";
import type { ProviderId } from "../../shared/providers";
import type { TranscriptMessage } from "../../preload/index";
import type { VoloApi, VoloEventMessage, SessionListItem } from "../../preload/index";

export interface ModelSelection {
  provider: ProviderId;
  model: string;
}

declare global {
  interface Window {
    volo: VoloApi;
  }
}

export type Status = "idle" | "starting" | "live" | "error";

export interface FeedItem {
  who: "you" | "agent";
  text: string;
}

export interface ApprovalLogItem {
  tool: string;
  decision: string;
  at: string;
}

export interface PendingApproval {
  id: string;
  tool: string;
  input: string;
  deadline: number;
  totalMs: number; // full approval window; drives the draining timer bar
}

/** Extract displayable text from unknown event payloads, defensively. */
export function textOf(e: unknown): string {
  if (!e || typeof e !== "object") return String(e ?? "");
  const rec = e as Record<string, unknown>;
  for (const k of ["text", "content", "delta", "message", "output", "chunk"]) {
    if (typeof rec[k] === "string" && rec[k]) return rec[k];
  }
  if (typeof rec.payload === "object" && rec.payload !== null) {
    const inner = (rec.payload as Record<string, unknown>).event;
    if (inner) return textOf(inner);
  }
  return JSON.stringify(e).slice(0, 300);
}

interface VoloState {
  sessions: SessionListItem[];
  activeId: string | null;
  feed: FeedItem[];
  approvals: ApprovalLogItem[];
  pendingApproval: PendingApproval | null;
  respondApproval: (approved: boolean) => Promise<void>;
  status: Status;
  sessionEnded: boolean; // a live session has ended; UI may show a resume hint
  error: string;
  busy: boolean;
  draft: string;
  meter: string;
  hasKey: boolean | null; // null = unknown yet (boot)
  updateAvailable: boolean;
  installUpdate: () => Promise<void>;
  viewedHistory: TranscriptMessage[] | null; // transcript of the viewed past session
  viewingPast: boolean; // true while a past (not live) session is open
  openPastSession: (id: string) => Promise<void>;
  backToLive: () => void;
  resumePastSession: (id: string, checkpointRunCount: number) => Promise<void>;
  modelSelection: ModelSelection;
  setModelSelection: (sel: ModelSelection) => void;
  setDraft: (d: string) => void;
  setActive: (id: string | null) => void;
  newConversation: () => void;
  bootstrap: () => Promise<void>;
  handleEvent: (msg: VoloEventMessage) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sendFollowUp: () => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
}

function sessionTitle(s: SessionListItem, fallback: string): string {
  return s.title ?? s.sessionId ?? fallback;
}

export const useVolo = create<VoloState>((set, get) => ({
  sessions: [],
  activeId: null,
  feed: [],
  approvals: [],
  pendingApproval: null,
  async respondApproval(approved) {
    const p = get().pendingApproval;
    if (!p) return;
    set({ pendingApproval: null });
    await window.volo.respondApproval(p.id, approved);
  },
  status: "idle",
  sessionEnded: false,
  error: "",
  busy: false,
  draft: "",
  meter: "$0.00 · 0 رمز",
  hasKey: null,
  updateAvailable: false,
  async installUpdate() {
    await window.volo.installUpdate();
  },
  viewedHistory: null,
  viewingPast: false,
  async openPastSession(id) {
    set({ viewingPast: true, viewedHistory: null, activeId: id });
    try {
      const { transcript } = await window.volo.history(id);
      set({ viewedHistory: transcript });
    } catch {
      set({ viewedHistory: [] });
    }
  },
  backToLive: () => set({ viewingPast: false, viewedHistory: null }),
  async resumePastSession(id, checkpointRunCount) {
    set({ busy: true, error: "" });
    try {
      const { sessionId } = await window.volo.resume(id, checkpointRunCount);
      set((s) => ({
        // The fork is a brand-new live session; seed the feed from the transcript.
        feed: (s.viewedHistory ?? []).map((m) => ({
          who: m.role === "user" ? ("you" as const) : ("agent" as const),
          text: m.blocks
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("\n"),
        })),
        activeId: sessionId,
        sessions: [{ sessionId, title: s.sessions.find((x) => x.sessionId === id)?.title ?? "متابعة" }, ...s.sessions],
        viewingPast: false,
        viewedHistory: null,
        status: "live",
        sessionEnded: false,
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },
  modelSelection: { provider: "anthropic", model: "claude-sonnet-5" },
  setModelSelection: (sel) => set({ modelSelection: sel }),

  setDraft: (d) => set({ draft: d }),
  setActive: (id) => set({ activeId: id }),
  newConversation: () =>
    set({ activeId: null, feed: [], status: "idle", sessionEnded: false, error: "", viewingPast: false, viewedHistory: null }),

  async bootstrap() {
    try {
      const { sessions } = await window.volo.list();
      set({
        sessions: sessions.map((s) => ({ ...s, title: sessionTitle(s, "جلسة") })),
      });
    } catch {
      /* first boot with no history */
    }
    await get().refreshKeyStatus();
  },

  handleEvent(msg) {
    if (msg.evt === "update") {
      const p = msg.payload as { state?: string };
      if (p?.state === "available") set({ updateAvailable: true });
      return;
    }
    if (msg.evt === "approval-request") {
      const p = msg.payload as {
        id?: string;
        tool?: string;
        input?: string;
        timeoutMs?: number;
      };
      if (p?.id && p.tool) {
        const totalMs = p.timeoutMs ?? 120000;
        set({
          pendingApproval: {
            id: p.id,
            tool: p.tool,
            input: p.input ?? "",
            deadline: Date.now() + totalMs,
            totalMs,
          },
        });
      }
      return;
    }
    if (msg.evt === "approval") {
      const p = msg.payload as { tool?: string; decision?: string };
      set((s) => ({
        approvals: [
          { tool: p.tool ?? "?", decision: p.decision ?? "?", at: new Date().toLocaleTimeString() },
          ...s.approvals,
        ].slice(0, 30),
      }));
      return;
    }
    // Session events: only chunk events are message text. Other types
    // (status, ended, hook, snapshot) are state, not prose.
    const p = msg.payload as { type?: string; payload?: Record<string, unknown> };
    if (p?.type === "chunk") {
      const chunk = p.payload as { chunk?: string } | undefined;
      const text: string | undefined = chunk?.chunk;
      if (text) {
        set((s) => {
          const feed = [...s.feed];
          const last = feed[feed.length - 1];
          if (last && last.who === "agent") {
            feed[feed.length - 1] = { ...last, text: last.text + text };
          } else {
            feed.push({ who: "agent", text });
          }
          return { feed };
        });
      }
      return;
    }
    if (p?.type === "ended") {
      set((s) => (s.status === "live" ? { status: "idle", sessionEnded: true } : {}));
      return;
    }
    if (p?.type === "status") {
      const st = (p.payload as { status?: string } | undefined)?.status;
      if (st) set({ status: st === "running" ? "live" : s_statusFallback(st) });
    }
  },

  async start() {
    const prompt = get().draft.trim();
    if (!prompt || get().busy) return;
    set({ busy: true, error: "", status: "starting", sessionEnded: false, feed: [{ who: "you", text: prompt }] });
    try {
      const { sessionId } = await window.volo.start(prompt, get().modelSelection);
      set((s) => ({
        activeId: sessionId,
        sessions: [{ sessionId, title: prompt.slice(0, 40) }, ...s.sessions],
        status: "live",
        draft: "",
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), status: "error" });
    } finally {
      set({ busy: false });
    }
  },

  async stop() {
    const id = get().activeId;
    if (!id) return;
    try {
      await window.volo.stop(id);
      set({ status: "idle", sessionEnded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async sendFollowUp() {
    const prompt = get().draft.trim();
    const id = get().activeId;
    if (!prompt || !id || get().busy) return;
    set({ busy: true, error: "" });
    try {
      await window.volo.send(id, prompt);
      set((s) => ({ feed: [...s.feed, { who: "you", text: prompt }], draft: "" }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  async refreshKeyStatus() {
    try {
      const info = await window.volo.keyStatus();
      set({ hasKey: info.hasKey });
    } catch {
      set({ hasKey: false });
    }
  },
}));

function s_statusFallback(st: string): Status {
  if (st === "idle" || st === "stopped" || st === "ended") return "idle";
  return "live";
}
