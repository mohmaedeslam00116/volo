import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapTranscript, mapTranscriptMessage } from "../src/shared/transcript.ts";

describe("mapTranscriptMessage", () => {
  it("maps a string-content message", () => {
    const m = mapTranscriptMessage({ role: "user", content: "مرحبا" });
    assert.deepEqual(m, { role: "user", blocks: [{ type: "text", text: "مرحبا" }] });
  });
  it("maps text + tool_use + tool_result blocks", () => {
    const m = mapTranscriptMessage({
      role: "assistant",
      content: [
        { type: "text", text: "Reading the file." },
        { type: "tool_use", id: "t1", name: "read_files", input: { path: "a.ts" } },
      ],
    });
    assert.equal(m?.blocks.length, 2);
    assert.equal(m?.blocks[1].type, "tool_use");
    assert.equal(m?.blocks[1].name, "read_files");
  });
  it("extracts text from tool_result string and array content", () => {
    const a = mapTranscriptMessage({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", name: "read_files", content: "file body" }],
    });
    assert.equal(a?.blocks[0].text, "file body");
    const b = mapTranscriptMessage({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          name: "run_commands",
          content: [{ type: "text", text: "ok" }],
          is_error: true,
        },
      ],
    });
    assert.equal(b?.blocks[0].text, "ok");
    assert.equal(b?.blocks[0].isError, true);
  });
  it("returns null on garbage and empty messages", () => {
    assert.equal(mapTranscriptMessage(null), null);
    assert.equal(mapTranscriptMessage("x"), null);
    assert.equal(mapTranscriptMessage({ role: "system", content: "x" }), null);
    assert.equal(mapTranscriptMessage({ role: "user", content: [] }), null);
  });
  it("maps a full transcript, dropping unmappable entries", () => {
    const out = mapTranscript([
      null,
      { role: "user", content: "hi" },
      { garbage: true },
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[1].role, "assistant");
  });
});
