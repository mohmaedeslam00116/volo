import React from "react";
import { ShieldCheck } from "lucide-react";
import { PROVIDER_INFO, PROVIDERS, type ProviderId } from "../../../shared/providers";
import { useVolo } from "../store";

/**
 * First-run gate: shown in the workspace until a key exists. One Arabic line
 * of pitch, provider + key form, honest failure path when OS encryption is
 * unavailable. Re-entry later stays available via the sidebar key form.
 */
export function OnboardingGate() {
  const [providerId, setProviderId] = React.useState<ProviderId>("anthropic");
  const [key, setKey] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [isError, setIsError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [encAvailable, setEncAvailable] = React.useState(true);
  const refreshKeyStatus = useVolo((s) => s.refreshKeyStatus);

  React.useEffect(() => {
    window.volo
      .keyStatus()
      .then((i) => setEncAvailable(i.encryptionAvailable))
      .catch(() => {});
  }, []);

  async function save() {
    setMsg("");
    setIsError(false);
    setSaving(true);
    try {
      await window.volo.setKey(providerId, key);
      setKey("");
      await refreshKeyStatus(); // flips hasKey → gate disappears
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setIsError(true);
      setMsg(
        m === "encryption-unavailable"
          ? "تشفير النظام غير متاح: رُفض الحفظ لحماية مفتاحك"
          : m === "invalid-key:key-too-short"
            ? "المفتاح قصير جداً"
            : m,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="card max-w-[440px] w-full">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-command" />
          <h2 className="text-base font-semibold text-ink m-0">مرحباً بك في Volo</h2>
        </div>
        <p dir="auto" className="text-[13px] text-ink-dim mt-2 mb-0">
          وكيل برمجي يعمل داخل مشروعك بالعربية: يقرأ، يقترح، وينفّذ، وكل خطوة خطرة
          تمر أولاً على موافقتك. ابدأ بلصق مفتاح النموذج؛ يُحفظ في سلسلة نظامك
          ولا يغادر جهازك.
        </p>
        {!encAvailable && (
          <div className="banner-error" role="alert" style={{ marginTop: 12 }}>
            تشفير النظام غير متاح: لن يُحفظ أي مفتاح هنا.
          </div>
        )}
        <select
          className="field"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value as ProviderId)}
          aria-label="المزود"
          disabled={saving}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_INFO[p].label}
            </option>
          ))}
        </select>
        <input
          className="field"
          type="password"
          value={key}
          dir="ltr"
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && key.trim()) save();
          }}
          placeholder="الصق مفتاح API"
          aria-label="مفتاح API"
          autoComplete="off"
        />
        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={save} disabled={saving || !key.trim()}>
            {saving ? "جارٍ الحفظ…" : "حفظ المفتاح"}
          </button>
        </div>
        {msg && (
          <p
            dir="auto"
            className={"text-xs mt-2 mb-0 " + (isError ? "text-danger" : "text-ink-dim")}
            role="status"
          >
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
