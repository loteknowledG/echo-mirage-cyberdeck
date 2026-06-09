/** Read-only snapshot of the Pi tab chat surface for MUTHUR context. */

export type PiScreenChatLine = {
  role: "user" | "assistant" | "tool" | "other";
  label: string;
  text: string;
};

export type PiScreenSnapshot = {
  capturedAt: string;
  mounted: boolean;
  model: string | null;
  thinkingLevel: string | null;
  isStreaming: boolean;
  chat: PiScreenChatLine[];
  streamingPi: string | null;
};

const CHAT_LINE_LIMIT = 16;
const STREAM_CHAR_LIMIT = 4000;

let latestSnapshot: PiScreenSnapshot | null = null;

type PiContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
  arguments?: unknown;
};

function flattenPiContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content as PiContentBlock[]) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && block.text) {
      parts.push(block.text);
      continue;
    }
    if (block.type === "thinking" && block.thinking) {
      parts.push(`(thinking) ${block.thinking}`);
      continue;
    }
    if (block.type === "toolCall" && block.name) {
      const args =
        typeof block.arguments === "string"
          ? block.arguments
          : JSON.stringify(block.arguments ?? {});
      parts.push(`(tool ${block.name}) ${args}`);
    }
  }
  return parts.join("\n\n").trim();
}

export function flattenPiAgentMessage(message: unknown): PiScreenChatLine | null {
  if (!message || typeof message !== "object") return null;
  const record = message as { role?: string; content?: unknown; toolCallId?: string };
  const role = record.role;

  if (role === "user") {
    const text = flattenPiContent(record.content);
    return text ? { role: "user", label: "OPERATOR", text } : null;
  }

  if (role === "assistant") {
    const text = flattenPiContent(record.content);
    return text ? { role: "assistant", label: "PI", text } : null;
  }

  if (role === "toolResult") {
    const text = flattenPiContent(record.content);
    return text
      ? { role: "tool", label: "TOOL", text: text.slice(0, 1200) }
      : null;
  }

  const text = flattenPiContent(record.content);
  return text ? { role: "other", label: "PI", text } : null;
}

export function setPiScreenSnapshot(snapshot: PiScreenSnapshot): void {
  latestSnapshot = snapshot;
  if (typeof window !== "undefined") {
    window.echoMiragePiScreenSnapshot = () => latestSnapshot;
  }
}

export function clearPiScreenSnapshot(): void {
  latestSnapshot = null;
  if (typeof window !== "undefined") {
    delete window.echoMiragePiScreenSnapshot;
  }
}

export function readPiScreenSnapshot(): PiScreenSnapshot | null {
  if (typeof window !== "undefined" && window.echoMiragePiScreenSnapshot) {
    return window.echoMiragePiScreenSnapshot();
  }
  return latestSnapshot;
}

export function formatPiScreenContextForMuthur(snapshot: PiScreenSnapshot | null): string {
  if (!snapshot?.mounted) {
    return "";
  }

  const lines: string[] = [
    "\n\n--- Pi screen (read-only) ---",
    `Captured: ${snapshot.capturedAt}`,
  ];

  if (snapshot.model) {
    lines.push(`Model: ${snapshot.model}`);
  }
  if (snapshot.thinkingLevel) {
    lines.push(`Thinking: ${snapshot.thinkingLevel}`);
  }
  if (snapshot.isStreaming) {
    lines.push("Status: streaming");
  }

  if (snapshot.chat.length > 0) {
    lines.push("", "Pi tab chat (recent):");
    for (const entry of snapshot.chat.slice(-CHAT_LINE_LIMIT)) {
      const body = entry.text.trim();
      if (!body) continue;
      lines.push(`[${entry.label}] ${body}`);
    }
  } else {
    lines.push("", "Pi tab chat: (empty)");
  }

  if (snapshot.streamingPi?.trim()) {
    const stream =
      snapshot.streamingPi.length > STREAM_CHAR_LIMIT
        ? `${snapshot.streamingPi.slice(0, STREAM_CHAR_LIMIT)}\n… [truncated]`
        : snapshot.streamingPi;
    lines.push("", `[PI] (streaming) ${stream}`);
  }

  lines.push(
    "",
    "Pi is a separate assistant in the π tab of the same cyberdeck. Use this snapshot when the operator asks what Pi said or what is on Pi's screen. You cannot control Pi from here.",
    "--- end Pi screen ---",
  );

  return lines.join("\n");
}

declare global {
  interface Window {
    echoMiragePiScreenSnapshot?: () => PiScreenSnapshot | null;
  }
}
