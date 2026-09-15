import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DEFAULT_MODELS, PROVIDER_INFO, modelsFor, type ProviderId } from "../../../shared/providers";
import { useVolo } from "../store";

/**
 * Model picker: selection confirmed in place, never a modal (DESIGN.md).
 * Native <details> gives keyboard + outside-click behavior without a
 * dependency; the menu is a plain positioned list.
 */
export function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(DEFAULT_MODELS.anthropic);
  const setModelSelection = useVolo((s) => s.setModelSelection);

  function pickProvider(p: ProviderId) {
    setProvider(p);
    const m = DEFAULT_MODELS[p];
    setModel(m);
    setModelSelection({ provider: p, model: m });
  }

  function pickModel(m: string) {
    setModel(m);
    setModelSelection({ provider, model: m });
    setOpen(false);
  }

  return (
    <details className="relative" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="model-pill cursor-pointer list-none">
        <span className="dot" />
        {PROVIDER_INFO[provider].label} · {model}
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
