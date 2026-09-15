// Pure approval policy (no Electron import: unit-testable under plain node).
// Canonical headless tool names verified in @cline/core (default host tools).
// Fail-closed: anything not explicitly listed resolves to DENY.

export const APPROVAL_TIMEOUT_MS = 120_000;

// Read-only: proceed silently, logged.
export const TIER_AUTO = new Set([
  "read_files",
  "search_codebase",
  "fetch_web_content",
  "web_search",
  "ask_question",
]);

// Writes, edits, commands, skills, schedules: ask every time.
export const TIER_ASK = new Set([
  "editor",
  "apply_patch",
  "run_commands",
  "skills",
  "tasks",
]);

// Hard-deny: never offered, never executed (MCP deferred to v1.1).
export const TIER_DENY_TOOLS = new Set([
  "spawn_agent",
  "teams",
  "team_spawn_teammate",
  "team_shutdown_teammate",
  "team_status",
  "team_task",
  "team_run_task",
  "team_cancel_run",
  "team_list_runs",
  "team_await_runs",
  "team_send_message",
  "team_broadcast",
  "team_read_mailbox",
  "team_mission_log",
  "team_cleanup",
  "team_create_outcome",
  "team_attach_outcome_fragment",
  "team_review_outcome_fragment",
  "team_finalize_outcome",
  "team_list_outcomes",
]);

const TIER_DENY_PATTERNS = [
  /rm\s+-rf/i,
  /mkfs/i,
  /diskpart/i,
  /format\s+[a-z]:/i,
  /Invoke-WebRequest.*\|\s*iex/i,
  /curl.*\|\s*(sh|bash)/i,
  /wget.*\|\s*(sh|bash)/i,
];

/** Pure verdict: "allow" | "ask" | "deny". Unknown tools deny. */
export function decideApproval(toolName, input) {
  const tool = typeof toolName === "string" ? toolName : "";
  const text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  if (TIER_DENY_TOOLS.has(tool)) return "deny";
  for (const rx of TIER_DENY_PATTERNS) {
    if (rx.test(tool) || rx.test(text)) return "deny";
  }
  if (TIER_AUTO.has(tool)) return "allow";
  if (TIER_ASK.has(tool)) return "ask";
  return "deny"; // fail-closed: unlisted (incl. all MCP tools) deny
}

/** toolPolicies mirror for ClineCore.start: explicit per-tool autoApprove. */
export function buildToolPolicies() {
  const p = {};
  for (const t of TIER_AUTO) p[t] = { autoApprove: true };
  for (const t of TIER_ASK) p[t] = { autoApprove: false };
  for (const t of TIER_DENY_TOOLS) p[t] = { enabled: false };
  return p;
}
