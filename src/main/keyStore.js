// Pure key-store helpers (no Electron import: unit-testable under plain node).
// Electron wiring (safeStorage + fs) lives in src/main/index.js.
import { join } from "node:path";

export const PROVIDERS = ["anthropic", "openai", "google"];

/** Validate user input. Never throws on key material; returns reason codes. */
export function validateKeyInput({ providerId, apiKey }) {
  if (!PROVIDERS.includes(providerId)) return { ok: false, error: "unknown-provider" };
  if (typeof apiKey !== "string" || apiKey.trim().length < 8)
    return { ok: false, error: "key-too-short" };
  if (apiKey.length > 500) return { ok: false, error: "key-too-long" };
  return { ok: true };
}

/** Fail-closed gate: no encryption available means no save, ever. */
export function decideSave(encryptionAvailable) {
  return encryptionAvailable === true;
}

export function secretsPath(userDataDir) {
  return join(userDataDir, "volo-keys.json");
}

/** Parse persisted record. Returns null on any shape problem (never throws). */
export function parseStored(raw) {
  try {
    const j = JSON.parse(raw);
    if (typeof j !== "object" || j === null) return null;
    if (!PROVIDERS.includes(j.providerId)) return null;
    if (typeof j.enc !== "string" || j.enc.length < 16) return null;
    return { providerId: j.providerId, enc: j.enc };
  } catch {
    return null;
  }
}
