import React from "react";
import { useVolo } from "../store";

/**
 * The product's handshake (DESIGN.md): a small centered dialog with the tool
 * name as title, an LTR mono preview, an amber timeout line, and two buttons.
 * Native <dialog> gives focus trap, Esc handling, and ::backdrop for free;
 * approvals never appear as toasts or inline links.
 */
export function ApprovalDialog() {
  const pending = useVolo((s) => s.pendingApproval);
  const respond = useVolo((s) => s.respondApproval);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [remaining, setRemaining] = React.useState(0);

  React.useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);

  React.useEffect(() => {
    if (!pending) return;
    const tick = () => setRemaining(Math.max(0, pending.deadline - Date.now()));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [pending]);

  // Timeout auto-deny happens in main; the UI only reflects it. If the
  // deadline passes while visible, main's verdict arrives as an approval
  // log event and clears the pending state.
  const seconds = Math.ceil(remaining / 1000);
  const urgent = pending !== null && remaining < 15_000;

  return (
    <dialog
      ref={dialogRef}
      aria-label="حوار الموافقة"
      onClick={(e) => {
        // Click on the backdrop (outside the inner card) = deny: the safe default.
        if (e.target === dialogRef.current && pending) respond(false);
      }}
      onCancel={(e) => {
        // Esc = deny.
        e.preventDefault();
        if (pending) respond(false);
      }}
      className="m-auto p-0 bg-transparent border-none"
    >
      <div className="bg-night-raised border border-line rounded-lg p-4 w-[440px] max-w-[90vw]">
        <h3 className="text-sm font-semibold text-ink m-0" dir="auto">
          {pending ? (
            <>
              {pending.tool === "run_commands" ? "تشغيل الأمر؟" : "السماح بالتعديل؟"}{" "}
              <span className="font-mono text-[11px] text-ink-dim" dir="ltr">
                {pending.tool}
              </span>
            </>
          ) : null}
        </h3>
        <pre dir="ltr" className="bg-night-base border border-line-faint rounded-md p-2 mt-2 max-h-48 overflow-auto font-mono text-xs text-ink">
          {pending?.input ?? ""}
        </pre>
        {pending && (
          <div className="flex items-center gap-2 mt-2">
            <div
              className={"h-1 flex-1 rounded-full " + (urgent ? "bg-danger" : "bg-lantern")}
              style={{
                opacity: 0.9,
                transformOrigin: "right",
              }}
            />
            <span
              className={
                "font-mono text-[11px] " + (urgent ? "text-danger" : "text-lantern-bright")
              }
              dir="ltr"
            >
              {seconds}s
            </span>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-3">
          <button className="nav-item w-auto" onClick={() => respond(false)} autoFocus>
            رفض {pending?.tool === "run_commands" ? "التشغيل" : "التعديل"}
          </button>
          <button className="btn-primary" onClick={() => respond(true)}>
            سماح {pending?.tool === "run_commands" ? "بالتشغيل" : "بالتعديل"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
