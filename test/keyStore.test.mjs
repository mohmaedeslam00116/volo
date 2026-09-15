import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateKeyInput, decideSave, secretsPath, parseStored, PROVIDERS } from "../src/main/keyStore.js";

describe("validateKeyInput", () => {
  it("accepts a known provider with a real key", () => {
    assert.equal(validateKeyInput({ providerId: "anthropic", apiKey: "sk-ant-123456789" }).ok, true);
  });
  it("rejects unknown providers", () => {
    assert.equal(validateKeyInput({ providerId: "evil", apiKey: "sk-ant-123456789" }).error, "unknown-provider");
  });
  it("rejects short/blank keys without echoing them", () => {
    for (const k of ["", "   ", "short", "s3cr3t!"]) {
      const r = validateKeyInput({ providerId: "openai", apiKey: k });
      assert.equal(r.ok, false);
      // reason codes only: the response must never contain key material
      assert.match(r.error, /^(key-too-short|key-too-long|unknown-provider)$/);
    }
  });
  it("rejects absurdly long input", () => {
    assert.equal(validateKeyInput({ providerId: "openai", apiKey: "x".repeat(501) }).error, "key-too-long");
  });
  it("covers every supported provider", () => {
    for (const p of PROVIDERS)
      assert.equal(validateKeyInput({ providerId: p, apiKey: "k".repeat(20) }).ok, true);
  });
});

describe("decideSave (fail-closed)", () => {
  it("allows save only when encryption is available", () => {
    assert.equal(decideSave(true), true);
    assert.equal(decideSave(false), false);
    assert.equal(decideSave(undefined), false);
    assert.equal(decideSave(null), false);
  });
});

describe("parseStored", () => {
  it("accepts a well-formed record", () => {
    const r = parseStored(JSON.stringify({ providerId: "google", enc: "ab".repeat(20) }));
    assert.deepEqual(r, { providerId: "google", enc: "ab".repeat(20) });
  });
  it("rejects garbage, wrong shapes, unknown providers", () => {
    assert.equal(parseStored("not-json"), null);
    assert.equal(parseStored("null"), null);
    assert.equal(parseStored(JSON.stringify({ providerId: "x", enc: "ab".repeat(20) })), null);
    assert.equal(parseStored(JSON.stringify({ providerId: "openai", enc: "short" })), null);
  });
});

describe("secretsPath", () => {
  it("stays a single file under the user data dir", () => {
    const p = secretsPath("/tmp/ud");
    assert.ok(p.endsWith("volo-keys.json"));
  });
});
