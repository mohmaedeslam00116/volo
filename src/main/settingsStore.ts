// Pure settings-store helpers (no Electron import: unit-testable).
// Model selection is a preference, not a secret: it lives in a plain
// JSON file next to the keychain record, never inside it.
import { join } from "node:path";
import { asProviderId, type ProviderId } from "../shared/providers.ts";

export interface ModelSettings {
  providerId: ProviderId;
  modelId: string;
}

export function settingsPath(userDataDir: string): string {
  return join(userDataDir, "volo-settings.json");
}

/** Parse + validate a settings record; null on any shape problem. */
export function parseSettings(raw: string, validModels: readonly string[]): ModelSettings | null {
  try {
    const j: unknown = JSON.parse(raw);
    if (typeof j !== "object" || j === null) return null;
    const rec = j as Record<string, unknown>;
    const providerId = asProviderId(rec.providerId);
    if (!providerId) return null;
    if (typeof rec.modelId !== "string" || !validModels.includes(rec.modelId)) return null;
    return { providerId, modelId: rec.modelId };
  } catch {
    return null;
  }
}

export function serializeSettings(s: ModelSettings): string {
  return JSON.stringify({ providerId: s.providerId, modelId: s.modelId });
}
