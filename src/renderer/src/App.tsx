import { MessageSquarePlus, RefreshCw, SendHorizontal, StopCircle } from "lucide-react";
import React from "react";
import { formatUsage } from "../../shared/usage";
import { ApprovalDialog } from "./components/ApprovalDialog";
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
  const feedRef = React.useRef<HTMLDivElement>(null);
  const nearBottomRef = React.useRef(true);

  // Stick to the bottom only while the user is actually near it: scrolling up
  // to read must not be hijacked by the stream. 48px ≈ one message.
  const onScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  React.useEffect(() => {
    if (!nearBottomRef.current) return;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [feed]);

  const pendingApproval = approvals[0]?.decision === "asking";
  const showSkeleton = status === "starting" && feed.length <= 1;

  return (
    <div className="feed" onScroll={onScroll} ref={feedRef}>
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
      {showSkeleton && <div className="skeleton" style={{ height: 42 }} aria-label="جارٍ البدء" />}
      {pendingApproval && (
        <div className="note !mt-0" role="status">
          الوكيل بانتظار موافقتك على خطوته التالية.
        </div>
      )}
      <div />
    </div>
  );
}

function Composer({ hideUntilLive, sessionEnded }: { hideUntilLive?: boolean; sessionEnded?: boolean }) {
  const draft = useVolo((s) => s.draft);
  const setDraft = useVolo((s) => s.setDraft);
  const busy = useVolo((s) => s.busy);
  const activeId = useVolo((s) => s.activeId);
  const status = useVolo((s) => s.status);
  const start = useVolo((s) => s.start);
  const sendFollowUp = useVolo((s) => s.sendFollowUp);
  const stop = useVolo((s) => s.stop);

  const live = !!(activeId && status === "live");
  const submit = () => (live ? sendFollowUp() : start());
  const hidden = hideUntilLive === true && !live;
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
        {live && (
          <button className="btn-ghost" onClick={stop}>
            <StopCircle size={14} /> إيقاف الجلسة
          </button>
        )}
        {sessionEnded && !live && activeId && (
          <span className="text-[11px] text-ink-dim">انتهت الجلسة. اكتب مهمة جديدة للبدء من جديد.</span>
        )}
        <button
          className="send"
          onClick={submit}
          disabled={busy || !draft.trim()}
          aria-label="إرسال"
        >
          <SendHorizontal size={14} className="-scale-x-100" />
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
        <span className="flex items-center gap-1.5">
          <span className={"status-dot " + status} aria-hidden="true" />
          الاتصال
        </span>
        <span className="val">
          {status === "live" ? "متصلة" : status === "error" ? "خطأ" : "خاملة"}
        </span>
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
          <div className="font-mono text-[10px] text-ink-dim mt-1" dir="ltr">
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

function UpdateBanner() {
  const updateAvailable = useVolo((s) => s.updateAvailable);
  const installUpdate = useVolo((s) => s.installUpdate);
  if (!updateAvailable) return null;
  return (
    <div
      className="flex items-center gap-2 justify-center py-1.5 text-[12px] text-lantern-bright bg-night-raised border-b border-line"
      role="status"
    >
      <RefreshCw size={12} />
      <span>إصدار جديد متاح وتم تنزيله.</span>
      <button className="btn-ghost !border-lantern !text-lantern-bright !py-0.5" onClick={installUpdate}>
        أعد التشغيل للتحديث
      </button>
    </div>
  );
}

export default function App() {
  const error = useVolo((s) => s.error);
  const activeId = useVolo((s) => s.activeId);
  const status = useVolo((s) => s.status);
  const sessionEnded = useVolo((s) => s.sessionEnded);
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
        <UpdateBanner />
        {error && (
          <div className="banner-error m-4" role="alert">
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
            <Composer sessionEnded={sessionEnded} />
          </>
        )}
      </main>
      <Inspector />
      <ApprovalDialog />
    </div>
  );
}
