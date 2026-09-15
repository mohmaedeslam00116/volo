// Pure provider/model catalog (no Electron import: unit-testable under plain node).
//
// Provider IDs verified in @cline/llms 0.0.83: BUILT_IN_PROVIDER_IDS has NO
// plain "openai" or "google" — the resolvable IDs are "openai-native" and
// "gemini". Model lists mirror the SDK's static generated catalogs
// (getGeneratedModelsForRuntimeProvider) so the picker needs no network.

export const PROVIDERS = ["anthropic", "openai-native", "gemini"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  models: string[];
}

/** Default model per provider: newest balanced general model in each catalog. */
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-5",
  "openai-native": "gpt-5.6",
  gemini: "gemini-3.8-flash",
};

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    models: [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-haiku-4-5",
      "claude-fable-5",
      "claude-sonnet-4-6",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-fable-5-1",
    ],
  },
  "openai-native": {
    id: "openai-native",
    label: "OpenAI",
    models: [
      "gpt-5.6",
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.3-codex",
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-pro",
      "o3-pro",
      "o3",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    models: [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
  },
};

/** Type-narrow a raw string to a ProviderId, or null. */
export function asProviderId(v: unknown): ProviderId | null {
  return typeof v === "string" && (PROVIDERS as readonly string[]).includes(v)
    ? (v as ProviderId)
    : null;
}

/** Models for a provider id; empty array for unknown providers. */
export function modelsFor(providerId: string): string[] {
  const p = asProviderId(providerId);
  return p ? PROVIDER_INFO[p].models : [];
}
