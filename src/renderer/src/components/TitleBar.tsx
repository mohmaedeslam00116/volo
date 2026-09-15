import { Minus, Square, X } from "lucide-react";
import { cn } from "../cn";
import pkg from "../../../../package.json";

const APP_VERSION: string = pkg.version;

function WinBtn({
  action,
  label,
  icon,
  danger,
}: {
  action: "min" | "max" | "close";
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={cn(danger && "close")}
      onClick={() => window.volo.win(action)}
    >
      {icon}
    </button>
  );
}

export function TitleBar() {
  return (
    <header className="titlebar area-title">
      <span className="brand">Volo</span>
      <span>مساحة عمل الوكيل</span>
      <span className="font-mono text-[10px] text-ink-dim" dir="ltr" title={`Volo v${APP_VERSION}`}>
        v{APP_VERSION}
      </span>
      <div className="winbtns">
        <WinBtn action="min" label="تصغير" icon={<Minus size={13} />} />
        <WinBtn action="max" label="تكبير" icon={<Square size={11} />} />
        <WinBtn action="close" label="إغلاق" danger icon={<X size={13} />} />
      </div>
    </header>
  );
}
