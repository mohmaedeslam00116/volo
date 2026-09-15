import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_MODELS, PROVIDER_INFO, modelsFor, type ProviderId } from "../../../shared/providers";
import { useVolo } from "../store";

/**
 * Model picker: selection confirmed in place, never a modal (DESIGN.md).
 * Native <details> gives the toggle; Escape and outside-click close it.
 */
export function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(DEFAULT_MODELS.anthropic);
  const rootRef = useRef<HTMLDetailsElement>(null);
  const setModelSelection = useVolo((s) => s.setModelSelection);

  // Hydrate from the persisted preference once on mount.
  useEffect(() => {
    window.volo
      .getModel()
      .then((saved) => {
        if (saved && modelsFor(saved.providerId).includes(saved.modelId)) {
          setProvider(saved.providerId as ProviderId);
          setModel(saved.modelId);
          setModelSelection({ provider: saved.providerId as ProviderId, model: saved.modelId });
        }
      })
      .catch(() => {});
  }, [setModelSelection]);

  // Escape and outside-click close the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  function pickProvider(p: ProviderId) {
    setProvider(p);
    const m = DEFAULT_MODELS[p];
    setModel(m);
    setModelSelection({ provider: p, model: m });
    window.volo.setModel(p, m).catch(() => {});
  }

  function pickModel(m: string) {
    setModel(m);
    setModelSelection({ provider, model: m });
    window.volo.setModel(provider, m).catch(() => {});
    setOpen(false);
  }

  return (
    <details
      ref={rootRef}
      className="relative"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="model-pill cursor-pointer list-none">
        {PROVIDER_INFO[provider].label} · <span dir="ltr">{model}</span>
        <ChevronDown size={12} className="text-ink-dim" />
      </summary>
      <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto bg-night-raised border border-line rounded-lg p-1">
        <div className="flex gap-1 p-1">
          {(["anthropic", "openai-native", "gemini"] as const).map((p) => (
            <button
              key={p}
              className={p === provider ? "nav-item active !py-1" : "nav-item !py-1"}
              onClick={() => pickProvider(p)}
            >
              {PROVIDER_INFO[p].label}
            </button>
          ))}
        </div>
        {modelsFor(provider).map((m) => (
          <button
            key={m}
            className={m === model ? "nav-item active !py-1" : "nav-item !py-1"}
            onClick={() => pickModel(m)}
          >
            <span className="font-mono text-[11px]" dir="ltr">
              {m}
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}
