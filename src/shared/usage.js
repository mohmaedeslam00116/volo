// Pure usage helpers (no Electron import: unit-testable under plain node).
// Source shape: SessionUsageSummary { usage?, aggregateUsage? } each with
// { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalCost }.

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Normalize any summary (or nothing) to zeros-safe { input, output, cost }. */
export function summarizeUsage(summary) {
  const pick = summary?.aggregateUsage ?? summary?.usage ?? {};
  return {
    input: num(pick.inputTokens) + num(pick.cacheReadTokens),
    output: num(pick.outputTokens) + num(pick.cacheWriteTokens),
    cost: num(pick.totalCost),
  };
}

function compact(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(Math.round(n));
}

/** Arabic display strings for the meter. Zero usage reads zero, never blank. */
export function formatUsage({ input, output, cost }) {
  const tokens = compact(input + output);
  const money = cost > 0 ? `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}` : "$0.00";
  return { line: `${money} · ${tokens} رمز`, cost: money, tokens };
}
