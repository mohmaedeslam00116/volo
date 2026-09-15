import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { settingsPath, parseSettings, serializeSettings } from "../src/main/settingsStore.ts";
import { PROVIDER_INFO } from "../src/shared/providers.ts";

describe("settingsStore", () => {
  it("stays a single file under the user data dir", () => {
    assert.ok(settingsPath("/ud").endsWith("volo-settings.json"));
  });
  it("round-trips a valid selection", () => {
    const s = { providerId: "anthropic", modelId: "claude-sonnet-5" };
    const back = parseSettings(serializeSettings(s), PROVIDER_INFO.anthropic.models);
    assert.deepEqual(back, s);
  });
  it("rejects unknown providers and unknown models", () => {
    assert.equal(
      parseSettings(JSON.stringify({ providerId: "openai", modelId: "gpt-5.6" }), ["gpt-5.6"]),
      null,
    );
    assert.equal(
      parseSettings(
        JSON.stringify({ providerId: "anthropic", modelId: "not-a-model" }),
        PROVIDER_INFO.anthropic.models,
      ),
      null,
    );
  });
  it("rejects garbage", () => {
    assert.equal(parseSettings("nope", []), null);
    assert.equal(parseSettings("null", []), null);
  });
});
