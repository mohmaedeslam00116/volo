// Pure key-store helpers (no Electron import: unit-testable under plain node).
// Electron wiring (safeStorage + fs) lives in src/main/index.ts.
import { join } from "node:path";
import { asProviderId, type ProviderId } from "../shared/providers.ts";

export function validateKeyInput({ providerId, apiKey }: { providerId: unknown; apiKey: unknown }):
  | { ok: true }
  | { ok: false; error: "unknown-provider" | "key-too-short" | "key-too-long" } {
  if (!asProviderId(providerId)) return { ok: false, error: "unknown-provider" };
  if (typeof apiKey !== "string" || apiKey.trim().length < 8)
    return { ok: false, error: "key-too-short" };
  if (apiKey.length > 500) return { ok: false, error: "key-too-long" };
  return { ok: true };
}

/** Fail-closed gate: no encryption available means no save, ever. */
export function decideSave(encryptionAvailable: unknown): boolean {
  return encryptionAvailable === true;
}

export function secretsPath(userDataDir: string): string {
  return join(userDataDir, "volo-keys.json");
}

export interface StoredRecord {
  providerId: ProviderId;
  enc: string;
}

/** Parse persisted record. Returns null on any shape problem (never throws). */
export function parseStored(raw: string): StoredRecord | null {
  try {
    const j: unknown = JSON.parse(raw);
    if (typeof j !== "object" || j === null) return null;
    const rec = j as Record<string, unknown>;
    const providerId = asProviderId(rec.providerId);
    if (!providerId) return null;
    const enc = rec.enc;
    if (typeof enc !== "string" || enc.length < 16) return null;
    return { providerId, enc };
  } catch {
    return null;
  }
}
