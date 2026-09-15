import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS, DEFAULT_MODELS, PROVIDER_INFO, asProviderId, modelsFor } from "../src/shared/providers.ts";

describe("providers", () => {
  it("exposes only SDK-resolvable provider ids", () => {
    // Verified against @cline/llms 0.0.83 BUILT_IN_PROVIDER_IDS.
    assert.deepEqual([...PROVIDERS], ["anthropic", "openai-native", "gemini"]);
    assert.equal(asProviderId("openai"), null);
    assert.equal(asProviderId("google"), null);
    assert.equal(asProviderId("openai-native"), "openai-native");
    assert.equal(asProviderId(42), null);
  });
  it("has a default model for every provider, drawn from its own catalog", () => {
    for (const p of PROVIDERS) {
      assert.ok(DEFAULT_MODELS[p].length > 0);
      assert.ok(PROVIDER_INFO[p].models.includes(DEFAULT_MODELS[p]));
      assert.ok(PROVIDER_INFO[p].label.length > 0);
    }
  });
  it("returns models only for known providers", () => {
    assert.ok(modelsFor("anthropic").length > 5);
    assert.deepEqual(modelsFor("nope"), []);
  });
});
