import React from "react";
import { formatUsage } from "../../shared/usage.js";

const api = () => window.volo;

/** Bidi-safe message: prose auto-dir, fenced code forced LTR. */
function Message({ text }) {
  const parts = String(text ?? "").split(/```/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="mono" dir="ltr">{p.replace(/^\w*\n/, "")}</pre>
        ) : (
          <p key={i} dir="auto">{p}</p>
        )
      )}
    </>
  );
}

function textOf(e) {
  if (!e || typeof e !== "object") return String(e ?? "");
  for (const k of ["text", "content", "delta", "message", "output"]) {
    if (typeof e[k] === "string" && e[k]) return e[k];
  }
  return JSON.stringify(e).slice(0, 300);
}

/** Key setup: wrote to OS keychain via main, never readable from here. */
function KeySettings() {
  const [providerId, setProviderId] = React.useState("anthropic");
  const [key, setKey] = React.useState("");
  const [info, setInfo] = React.useState(null);
  const [msg, setMsg] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function refresh() {
    try { setInfo(await api().keyStatus()); } catch (e) { setMsg(e.message); }
  }
  React.useEffect(() => { refresh(); }, []);

  async function save() {
    setMsg(""); setSaving(true);
    try {
      const r = await api().setKey(providerId, key);
      setKey("");
      setMsg(`تم الحفظ في سلسلة النظام (${r.providerId})`);
      refresh();
    } catch (e) {
      setMsg(e.message === "encryption-unavailable"
        ? "تشفير النظام غير متاح: رُفض الحفظ لحماية مفتاحك"
        : e.message === "invalid-key:unknown-provider" ? "مزود غير معروف"
        : e.message === "invalid-key:key-too-short" ? "المفتاح قصير جداً"
        : e.message);
    } finally { setSaving(false); }
  }

  async function clear() {
    setMsg("");
    try { await api().clearKey(); setMsg("تم مسح المفتاح"); refresh(); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <div className="section-label">مفتاح النموذج</div>
      <div className="kv">
        <span>الحالة</span>
        <span className="mono">{info ? (info.hasKey ? `محفوظ (${info.providerId})` : "لا مفتاح") : "…"}</span>
      </div>
      {info && !info.encryptionAvailable && (
        <div className="banner-error" role="alert">تشفير النظام غير متاح: لن يُحفظ أي مفتاح هنا.</div>
      )}
      <select className="field" value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label="المزود">
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="google">Google</option>
      </select>
      <input
        className="field" type="password" value={key} dir="ltr"
        onChange={(e) => setKey(e.target.value)}
        placeholder="الصق المفتاح (لا يُعرض ولا يُحفظ نصاً)"
        aria-label="مفتاح API" autoComplete="off"
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-primary" onClick={save} disabled={saving || !key.trim()}>حفظ في النظام</button>
        {info?.hasKey && <button className="nav-item" style={{ width: "auto" }} onClick={clear}>مسح</button>}
      </div>
      {msg && <p dir="auto" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{msg}</p>}
    </div>
  );
}

function TitleBar() {  const btn = (a, label, cls) => (
    <button key={a} className={cls} aria-label={label} onClick={() => api().win(a)}>{label}</button>
  );
  return (
    <header className="titlebar">
      <span className="brand">Volo</span>
      <span>مساحة عمل الوكيل</span>
      <div className="winbtns">
        {btn("min", "−")}
        {btn("max", "▢")}
        {btn("close", "✕", "close")}
      </div>
    </header>
  );
}

export default function App() {
  const [sessions, setSessions] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [feed, setFeed] = React.useState([]);
  const [approvals, setApprovals] = React.useState([]);
  const [status, setStatus] = React.useState("idle"); // idle|starting|live|error
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [meter, setMeter] = React.useState("0");
  const bottomRef = React.useRef(null);

  React.useEffect(() => {
    api().list().then((r) => setSessions(r.sessions ?? [])).catch(() => {});
    api().onEvent(({ evt, payload }) => {
      if (evt === "approval") {
        setApprovals((a) => [{ ...payload, at: new Date().toLocaleTimeString() }, ...a].slice(0, 30));
      } else {
        setFeed((f) => [...f, { who: "agent", text: textOf(payload), raw: evt }]);
      }
    });
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  React.useEffect(() => {
    if (status !== "live" || !activeId) return;
    let stop = false;
    const pull = () => {
      api().usage(activeId)
        .then((u) => { if (!stop) setMeter(formatUsage(u).line); })
        .catch(() => {});
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [status, activeId, feed]);

  async function start() {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setBusy(true); setError(""); setStatus("starting");
    setFeed([{ who: "you", text: prompt }]);
    try {
      const { sessionId } = await api().start(prompt);
      setActiveId(sessionId);
      setSessions((s) => [{ sessionId, title: prompt.slice(0, 40) }, ...s]);
      setStatus("live"); setDraft("");
    } catch (e) {
      setError(e.message); setStatus("error");
    } finally { setBusy(false); }
  }

  async function abort() {
    if (!activeId) return;
    try { await api().abort(activeId); } catch (e) { setError(e.message); }
  }

  const pendingApproval = approvals[0]?.decision === "asking";

  return (
    <div className="shell">
      <TitleBar />
      <aside className="sidebar" aria-label="الجلسات">
        <button className="btn-primary" onClick={() => { setActiveId(null); setFeed([]); setStatus("idle"); setError(""); }}>
          محادثة جديدة +
        </button>
        <div className="section-label">الجلسات</div>
        {sessions.length === 0 && <div className="msg"><p dir="auto">لا جلسات بعد. ابدأ مهمتك الأولى من الأسفل.</p></div>}
        {sessions.map((s) => (
          <button
            key={s.sessionId ?? s.id ?? Math.random()}
            className={"nav-item" + ((s.sessionId ?? s.id) === activeId ? " active" : "")}
            onClick={() => setActiveId(s.sessionId ?? s.id)}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="auto">
              {s.title ?? s.sessionId ?? s.id}
            </span>
            {pendingApproval && (s.sessionId ?? s.id) === activeId && <span className="unread" />}
          </button>
        ))}
        <div className="section-label">الحالة</div>
        <div className="kv"><span>الاتصال</span><span className="mono">{status === "live" ? "متصلة" : status === "error" ? "خطأ" : "خاملة"}</span></div>
        <div className="kv"><span>التكلفة</span><span className="mono cost" dir="auto">{activeId ? meter : "0"}</span></div>
        <KeySettings />
      </aside>

      <main className="workspace" aria-label="المحادثة">
        {error && <div className="banner-error" role="alert" style={{ margin: 16 }}>{error}</div>}
        <div className="feed">
          {feed.length === 0 && (
            <div className="empty">
              <h2>فوض مهمتك الأولى للوكيل</h2>
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
          {status === "starting" && <div className="skeleton" style={{ height: 42 }} aria-label="جارٍ البدء" />}
          {pendingApproval && <span className="chip asking">بانتظار موافقتك في حوار النظام…</span>}
          <div ref={bottomRef} />
        </div>
        <div className="composer">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); start(); } }}
            placeholder="اسأل أي شيء، اذكر مشروعك، واطلب التنفيذ…"
            aria-label="موجه الوكيل"
          />
          <div className="row">
            <span className="model-pill"><span className="dot" />النموذج الافتراضي</span>
            {activeId && status === "live" && (
              <button className="nav-item" style={{ width: "auto" }} onClick={abort}>إيقاف الجلسة</button>
            )}
            <button className="send" onClick={start} disabled={busy || !draft.trim()} aria-label="إرسال">↑</button>
          </div>
        </div>
      </main>

      <aside className="inspector" aria-label="الفحص">
        <h3 className="pane-title">الجلسة النشطة</h3>
        <div className="kv"><span>المعرف</span><span className="mono">{activeId ? String(activeId).slice(0, 12) + "…" : "—"}</span></div>
        <div className="kv"><span>الوضع</span><span className="mono">{status}</span></div>
        <div className="section-label">سجل الموافقات</div>
        {approvals.length === 0 && <p dir="auto" style={{ fontSize: 12, color: "var(--ink-dim)" }}>لا موافقات بعد. القراءة تُسمح تلقائياً، والكتابة تسأل.</p>}
        {approvals.map((a, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span className={"chip " + (a.decision === "asking" ? "asking" : a.decision === "hard-deny" || a.decision === "denied" ? "denied" : a.decision === "allowed" ? "allowed" : "")}>
              {a.tool}
            </span>
            <div className="mono" style={{ color: "var(--ink-faint)", marginTop: 4 }}>{a.decision} · {a.at}</div>
          </div>
        ))}
        <div className="card note" style={{ marginTop: 16 }}>
          الدمج يدوي: راجع الـ diff في مشروعك قبل قبول أي تغيير.
        </div>
      </aside>
    </div>
  );
}
