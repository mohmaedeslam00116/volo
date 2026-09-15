import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideApproval, buildToolPolicies, APPROVAL_TIMEOUT_MS, TIER_AUTO, TIER_ASK, TIER_DENY_TOOLS } from "../src/main/approvals.js";

describe("decideApproval", () => {
  it("auto-allows read-only tools", () => {
    for (const t of ["read_files", "search_codebase", "fetch_web_content", "web_search", "ask_question"])
      assert.equal(decideApproval(t, {}), "allow");
  });
  it("asks for writes, edits, commands, skills, schedules", () => {
    for (const t of ["editor", "apply_patch", "run_commands", "skills", "tasks"])
      assert.equal(decideApproval(t, {}), "ask");
  });
  it("hard-denies spawn/teams tools", () => {
    assert.equal(decideApproval("spawn_agent", {}), "deny");
    assert.equal(decideApproval("team_run_task", {}), "deny");
    assert.equal(decideApproval("teams", {}), "deny");
  });
  it("denies unknown tools (fail-closed, incl. MCP-shaped names)", () => {
    for (const t of ["mcp_filesystem", "brand_new_tool", "", null, undefined])
      assert.equal(decideApproval(t, {}), "deny");
  });
  it("denies destructive patterns even on ask-tier tools", () => {
    assert.equal(decideApproval("run_commands", { command: "rm -rf /tmp/x" }), "deny");
    assert.equal(decideApproval("editor", "please mkfs the disk"), "deny");
    assert.equal(decideApproval("run_commands", { command: "ls -la" }), "ask");
  });
  it("timeout constant is a sane finite value", () => {
    assert.ok(Number.isFinite(APPROVAL_TIMEOUT_MS) && APPROVAL_TIMEOUT_MS >= 60_000);
  });
});

describe("buildToolPolicies", () => {
  it("mirrors tiers explicitly with no overlap", () => {
    const p = buildToolPolicies();
    for (const t of TIER_AUTO) assert.deepEqual(p[t], { autoApprove: true });
    for (const t of TIER_ASK) assert.deepEqual(p[t], { autoApprove: false });
    for (const t of TIER_DENY_TOOLS) assert.deepEqual(p[t], { enabled: false });
    const keys = new Set(Object.keys(p));
    assert.equal(keys.size, TIER_AUTO.size + TIER_ASK.size + TIER_DENY_TOOLS.size);
  });
});
