// Transcript types + defensive mapping for session history display.
// Source: ClineCore.readDisplayMessages → SessionDisplayMessage[] (@cline/core 0.0.83),
// whose .message is a MessageWithMetadata: { role, content: string | ContentBlock[] }.

export interface TranscriptTextBlock {
  type: "text";
  text: string;
}

export interface TranscriptToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TranscriptToolResult {
  type: "tool_result";
  toolUseId: string;
  name: string;
  text: string;
  isError: boolean;
}

export type TranscriptBlock = TranscriptTextBlock | TranscriptToolUse | TranscriptToolResult;

export interface TranscriptMessage {
  role: "user" | "assistant";
  blocks: TranscriptBlock[];
}

function textFromResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
          ? (c as { text: string }).text
          : "",
      )
      .join("");
  }
  return "";
}

/** Map one raw display message into display blocks; skips nothing user-visible. */
export function mapTranscriptMessage(raw: unknown): TranscriptMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as { role?: unknown; message?: unknown; content?: unknown };
  const msg = (m.message ?? m) as { role?: unknown; content?: unknown };
  const role = msg.role === "assistant" ? "assistant" : msg.role === "user" ? "user" : null;
  if (!role) return null;

  const blocks: TranscriptBlock[] = [];
  const content = msg.content;
  if (typeof content === "string") {
    if (content.trim()) blocks.push({ type: "text", text: content });
  } else if (Array.isArray(content)) {
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const b = c as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        blocks.push({ type: "text", text: b.text });
      } else if (b.type === "tool_use" && typeof b.name === "string") {
        blocks.push({
          type: "tool_use",
          id: typeof b.id === "string" ? b.id : "",
          name: b.name,
          input: (b.input ?? {}) as Record<string, unknown>,
        });
      } else if (b.type === "tool_result" && typeof b.name === "string") {
        blocks.push({
          type: "tool_result",
          toolUseId: typeof b.tool_use_id === "string" ? b.tool_use_id : "",
          name: b.name,
          text: textFromResultContent(b.content).slice(0, 2000),
          isError: b.is_error === true,
        });
      }
      // thinking/image/file/redacted blocks: intentionally not rendered in v1
    }
  }
  if (blocks.length === 0) return null;
  return { role, blocks };
}

/** Map a full raw transcript; nulls dropped. */
export function mapTranscript(raw: unknown): TranscriptMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(mapTranscriptMessage).filter((m): m is TranscriptMessage => m !== null);
}
