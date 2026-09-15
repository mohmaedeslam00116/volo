import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeUsage, formatUsage } from "../src/shared/usage.ts";

describe("summarizeUsage", () => {
  it("reads zero on nothing", () => {
    assert.deepEqual(summarizeUsage(undefined), { input: 0, output: 0, cost: 0 });
    assert.deepEqual(summarizeUsage(null), { input: 0, output: 0, cost: 0 });
    assert.deepEqual(summarizeUsage({}), { input: 0, output: 0, cost: 0 });
  });
  it("prefers aggregateUsage over usage", () => {
    const s = summarizeUsage({
      usage: { inputTokens: 1, outputTokens: 1, totalCost: 1 },
      aggregateUsage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 0, totalCost: 0.02 },
    });
    assert.deepEqual(s, { input: 110, output: 5, cost: 0.02 });
  });
  it("falls back to usage when aggregate missing", () => {
    assert.deepEqual(summarizeUsage({ usage: { inputTokens: 7, outputTokens: 3, totalCost: 0 } }),
      { input: 7, output: 3, cost: 0 });
  });
  it("coerces garbage numbers to zero", () => {
    const s = summarizeUsage({ usage: { inputTokens: -5, outputTokens: NaN, totalCost: "x" } });
    assert.deepEqual(s, { input: 0, output: 0, cost: 0 });
  });
});

describe("formatUsage", () => {
  it("reads zero, never blank", () => {
    const f = formatUsage({ input: 0, output: 0, cost: 0 });
    assert.equal(f.cost, "$0.00");
    assert.ok(f.line.length > 0);
  });
  it("compacts large token counts and money", () => {
    const f = formatUsage({ input: 1500, output: 500, cost: 0.0234 });
    assert.equal(f.tokens, "2.0k");
    assert.equal(f.cost, "$0.02");
  });
  it("shows sub-cent costs with precision", () => {
    assert.equal(formatUsage({ input: 10, output: 5, cost: 0.0012 }).cost, "$0.0012");
  });
});
