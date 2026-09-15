import { Wrench, ArrowRight } from "lucide-react";
import { Message } from "./Message";
import { useVolo } from "../store";

function ToolBlock({ name, text, isError }: { name: string; text?: string; isError?: boolean }) {
  return (
    <div
      className={
        "flex items-center gap-2 text-[11px] rounded-md px-2 py-1 border " +
        (isError
          ? "border-danger text-danger"
          : "border-line-faint text-ink-dim bg-night-base")
      }
      dir="ltr"
    >
      <Wrench size={11} />
      <span className="font-mono">{name}</span>
      {text && (
        <span className="font-mono text-ink-faint truncate max-w-[420px]">{text.slice(0, 120)}</span>
      )}
    </div>
  );
}

export function TranscriptView() {
  const viewedHistory = useVolo((s) => s.viewedHistory);
  const backToLive = useVolo((s) => s.backToLive);
  const sessions = useVolo((s) => s.sessions);
  const activeId = useVolo((s) => s.activeId);
  const resume = useVolo((s) => s.resumePastSession);

  const viewed = sessions.find((s) => s.sessionId === activeId);
  const canResume = !!viewed?.checkpointRunCount;

  return (
    <div className="feed" role="log" aria-label="سجل الجلسة">
      <div className="flex items-center gap-2 mb-2">
        <button className="btn-ghost" onClick={backToLive}>
          <ArrowRight size={13} /> رجوع
        </button>
        <span className="chip">{viewed?.title ?? viewed?.sessionId ?? "جلسة سابقة"}</span>
        {canResume && (
          <button
            className="btn-primary ms-auto"
            onClick={() => viewed && resume(viewed.sessionId, viewed.checkpointRunCount!)}
          >
            متابعة هذه الجلسة
          </button>
        )}
      </div>
      {viewedHistory === null && <div className="skeleton" style={{ height: 42 }} />}
      {viewedHistory?.length === 0 && (
        <p dir="auto" className="text-ink-dim text-[13px]">
          لا يوجد سجل محفوظ لهذه الجلسة.
        </p>
      )}
      {viewedHistory?.map((m, i) => (
        <div className="msg" key={i}>
          <div className="who">{m.role === "user" ? "أنت" : "الوكيل"}</div>
          {m.blocks.map((b, j) =>
            b.type === "text" ? (
              <Message key={j} text={b.text} />
            ) : b.type === "tool_use" ? (
              <ToolBlock key={j} name={b.name} />
            ) : (
              <ToolBlock key={j} name={b.name} text={b.text} isError={b.isError} />
            ),
          )}
        </div>
      ))}
      <div />
    </div>
  );
}
