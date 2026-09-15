import React from "react";
import { PROVIDER_INFO, PROVIDERS } from "../../../shared/providers";
import { useVolo } from "../store";

/** Key setup: wrote to OS keychain via main, never readable from here. */
export function KeySettings() {
  const [providerId, setProviderId] = React.useState<(typeof PROVIDERS)[number]>("anthropic");
  const [key, setKey] = React.useState("");
  const [info, setInfo] = React.useState<Awaited<
    ReturnType<typeof window.volo.keyStatus>
  > | null>(null);
  const [msg, setMsg] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const refreshKeyStatus = useVolo((s) => s.refreshKeyStatus);

  React.useEffect(() => {
    window.volo
      .keyStatus()
      .then(setInfo)
      .catch((e: Error) => setMsg(e.message));
  }, []);

  async function save() {
    setMsg("");
    setSaving(true);
    try {
      const r = await window.volo.setKey(providerId, key);
      setKey("");
      setMsg(`تم الحفظ في سلسلة النظام (${r.providerId})`);
      await refreshKeyStatus();
      setInfo(await window.volo.keyStatus());
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(
        m === "encryption-unavailable"
          ? "تشفير النظام غير متاح: رُفض الحفظ لحماية مفتاحك"
          : m === "invalid-key:unknown-provider"
            ? "مزود غير معروف"
            : m === "invalid-key:key-too-short"
              ? "المفتاح قصير جداً"
              : m,
      );
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setMsg("");
    try {
      await window.volo.clearKey();
      setMsg("تم مسح المفتاح");
      await refreshKeyStatus();
      setInfo(await window.volo.keyStatus());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="section-label">مفتاح النموذج</div>
      <div className="kv">
        <span>الحالة</span>
        <span className="val">
          {info ? (info.hasKey ? `محفوظ (${info.providerId})` : "لا مفتاح") : "…"}
        </span>
      </div>
      {info && !info.encryptionAvailable && (
        <div className="banner-error" role="alert">
          تشفير النظام غير متاح: لن يُحفظ أي مفتاح هنا.
        </div>
      )}
      <select
        className="field"
        value={providerId}
        onChange={(e) => setProviderId(e.target.value as (typeof PROVIDERS)[number])}
        aria-label="المزود"
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
        placeholder="الصق المفتاح (لا يُعرض ولا يُحفظ نصاً)"
        aria-label="مفتاح API"
        autoComplete="off"
      />
      <div className="flex gap-2 mt-2">
        <button className="btn-primary" onClick={save} disabled={saving || !key.trim()}>
          حفظ في النظام
        </button>
        {info?.hasKey && (
          <button className="nav-item w-auto" onClick={clear}>
            مسح
          </button>
        )}
      </div>
      {msg && (
        <p dir="auto" className="text-xs text-ink-dim mt-1">
          {msg}
        </p>
      )}
    </div>
  );
}
