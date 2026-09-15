import { MessageSquarePlus, SendHorizontal, StopCircle } from "lucide-react";
import React from "react";
import { formatUsage } from "../../shared/usage";
import { KeySettings } from "./components/KeySettings";
import { OnboardingGate } from "./components/OnboardingGate";
import { Message } from "./components/Message";
import { ModelPicker } from "./components/ModelPicker";
import { TitleBar } from "./components/TitleBar";
import { TranscriptView } from "./components/TranscriptView";
import { useVolo } from "./store";

function SessionFeed() {
  const feed = useVolo((s) => s.feed);
  const status = useVolo((s) => s.status);
  const approvals = useVolo((s) => s.approvals);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const pendingApproval = approvals[0]?.decision === "asking";

  return (
    <div className="feed">
      {feed.length === 0 && (
        <div className="empty">
          <h2>فوّض مهمتك الأولى للوكيل</h2>
          <ol>
            <li>اكتب مهمة برمجية بالعربية في الأسفل</li>
            <li>الوكيل يعمل، وأي أمر خطير يتوقف عند حوار موافقة</li>
            <li>راجع النتائج والموافقات في اللوحة الجانبية</li>
          </ol>
        </div>
      )}
      {feed.map((m, i) => (
        <div className="msg" key={i}>
          <div className="who">{m.who === "you" ? "أنت" : "الوكيل"}</div>
          <Message text={m.text} />
        </div>
      ))}
      {status === "starting" && (
        <div className="skeleton" style={{ height: 42 }} aria-label="جارٍ البدء" />
      )}
      {pendingApproval && <span className="chip asking">بانتظار موافقتك في حوار النظام…</span>}
      <div ref={bottomRef} />
    </div>
  );
}

function Composer({ hideUntilLive }: { hideUntilLive?: boolean }) {
  const draft = useVolo((s) => s.draft);
  const setDraft = useVolo((s) => s.setDraft);
  const busy = useVolo((s) => s.busy);
  const activeId = useVolo((s) => s.activeId);
  const status = useVolo((s) => s.status);
  const start = useVolo((s) => s.start);
  const sendFollowUp = useVolo((s) => s.sendFollowUp);
  const stop = useVolo((s) => s.stop);

  const submit = () => (activeId && status === "live" ? sendFollowUp() : start());
  const hidden = hideUntilLive === true && !(activeId && status === "live");
  if (hidden) return null;

  return (
    <div className="composer">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="اسأل أي شيء، اذكر مشروعك، واطلب التنفيذ…"
        aria-label="موجه الوكيل"
      />
      <div className="row">
        <ModelPicker />
        {activeId && status === "live" && (
          <button className="nav-item w-auto" onClick={stop}>
            <StopCircle size={14} /> إيقاف الجلسة
          </button>
        )}
        <button
          className="send"
          onClick={submit}
          disabled={busy || !draft.trim()}
          aria-label="إرسال"
        >
          <SendHorizontal size={14} />
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const sessions = useVolo((s) => s.sessions);
  const activeId = useVolo((s) => s.activeId);
  const setActive = useVolo((s) => s.setActive);
  const newConversation = useVolo((s) => s.newConversation);
  const status = useVolo((s) => s.status);
  const meter = useVolo((s) => s.meter);
  const approvals = useVolo((s) => s.approvals);
  const hasKey = useVolo((s) => s.hasKey);

  const pendingApproval = approvals[0]?.decision === "asking";

  return (
    <aside className="sidebar area-side" aria-label="الجلسات">
      <button
        className="btn-primary flex items-center justify-center gap-1.5"
        onClick={newConversation}
      >
        <MessageSquarePlus size={14} /> محادثة جديدة
      </button>
      <div className="section-label">الجلسات</div>
      {sessions.length === 0 && (
        <div className="msg">
          <p dir="auto">لا جلسات بعد. ابدأ مهمتك الأولى من الأسفل.</p>
        </div>
      )}
      {sessions.map((s) => (
        <button
          key={s.sessionId}
          className={s.sessionId === activeId ? "nav-item active" : "nav-item"}
          onClick={() => setActive(s.sessionId)}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap" dir="auto">
            {s.title ?? s.sessionId}
          </span>
          {pendingApproval && s.sessionId === activeId && <span className="unread-dot" />}
        </button>
      ))}
      <div className="section-label">الحالة</div>
      <div className="kv">
        <span>الاتصال</span>
        <span className="val">{status === "live" ? "متصلة" : status === "error" ? "خطأ" : "خاملة"}</span>
      </div>
      <div className="kv">
        <span>التكلفة</span>
        <span className="val cost" dir="auto">
          {meter}
        </span>
      </div>
      {hasKey === false && (
        <div className="note" role="status">
          أضف مفتاح النموذج للبدء — يُحفظ في سلسلة النظام ولا يغادر جهازك.
        </div>
      )}
      <KeySettings />
    </aside>
  );
}

function Inspector() {
  const activeId = useVolo((s) => s.activeId);
  const status = useVolo((s) => s.status);
  const approvals = useVolo((s) => s.approvals);

  return (
    <aside className="inspector area-insp" aria-label="الفحص">
      <h3 className="pane-title">الجلسة النشطة</h3>
      <div className="kv">
        <span>المعرف</span>
        <span className="val">{activeId ? String(activeId).slice(0, 12) + "…" : "—"}</span>
      </div>
      <div className="kv">
        <span>الوضع</span>
        <span className="val" dir="ltr">
          {status}
        </span>
      </div>
      <div className="section-label">سجل الموافقات</div>
      {approvals.length === 0 && (
        <p dir="auto" className="text-xs text-ink-dim">
          لا موافقات بعد. القراءة تُسمح تلقائياً، والكتابة تسأل.
        </p>
      )}
      {approvals.map((a, i) => (
        <div key={i} className="mb-2">
          <span
            className={
              "chip " +
              (a.decision === "asking"
                ? "asking"
                : a.decision === "hard-deny" || a.decision === "denied"
                  ? "denied"
                  : a.decision === "allowed"
                    ? "allowed"
                    : "")
            }
          >
            {a.tool}
          </span>
          <div className="font-mono text-[10px] text-ink-faint mt-1" dir="ltr">
            {a.decision} · {a.at}
          </div>
        </div>
      ))}
      <div className="card note mt-4">
        الدمج يدوي: راجع الـ diff في مشروعك قبل قبول أي تغيير.
      </div>
    </aside>
  );
}

export default function App() {
  const error = useVolo((s) => s.error);
  const activeId = useVolo((s) => s.activeId);
  const status = useVolo((s) => s.status);
  const feed = useVolo((s) => s.feed);
  const bootstrap = useVolo((s) => s.bootstrap);
  const handleEvent = useVolo((s) => s.handleEvent);
  const viewingPast = useVolo((s) => s.viewingPast);
  const hasKey = useVolo((s) => s.hasKey);

  React.useEffect(() => {
    bootstrap();
    window.volo.onEvent(handleEvent);
  }, [bootstrap, handleEvent]);

  // Live cost meter: polls accumulated usage while a session runs.
  React.useEffect(() => {
    if (status !== "live" || !activeId || viewingPast) return;
    let stop = false;
    const pull = () => {
      window.volo
        .usage(activeId)
        .then((u) => {
          if (!stop) useVolo.setState({ meter: formatUsage(u).line });
        })
        .catch(() => {});
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [status, activeId, feed, viewingPast]);

  return (
    <div className="shell">
      <TitleBar />
      <Sidebar />
      <main className="workspace area-main" aria-label="المحادثة">
        {error && (
          <div className="banner-error" role="alert" style={{ margin: 16 }}>
            {error}
          </div>
        )}
        {hasKey === false && !viewingPast ? (
          <OnboardingGate />
        ) : viewingPast ? (
          <>
            <TranscriptView />
            <Composer hideUntilLive />
          </>
        ) : (
          <>
            <SessionFeed />
            <Composer />
          </>
        )}
      </main>
      <Inspector />
    </div>
  );
}
