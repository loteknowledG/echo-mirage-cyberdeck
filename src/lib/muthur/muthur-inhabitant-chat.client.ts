import { formatMuthurScreenContextForPi, readMuthurScreenSnapshot } from "@/lib/muthur-screen-context";
import { buildGlyphContextSnapshot } from "@/lib/glyph-channel";
import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";
import {
  formatInhabitantChannelLabel,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";

type InhabitantHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

function buildInhabitantHistory(
  messages: MuthurChatMessage[],
  limit = 8,
): InhabitantHistoryEntry[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: message.text.trim(),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-limit);
}

async function readPlainTextStream(
  response: Response,
  onChunk: (text: string) => void,
): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    onChunk(text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    fullText += chunk;
    onChunk(fullText);
  }

  const rest = decoder.decode();
  if (rest) {
    fullText += rest;
    onChunk(fullText);
  }

  return fullText;
}

export async function sendMuthurInhabitantMessage(input: {
  inhabitant: Exclude<MuthurInhabitant, "muthur">;
  userMessage: string;
  messages: MuthurChatMessage[];
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const history = buildInhabitantHistory(input.messages);
  const label = formatInhabitantChannelLabel(input.inhabitant);
  input.onStream?.(`⏳ ${label} // uplink…\n`);

  if (input.inhabitant === "codex") {
    const response = await fetch("/api/muthur-codex-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: input.signal,
      body: JSON.stringify({
        message: input.userMessage,
        history,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; text: string }
      | { ok: false; error?: string }
      | null;

    if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
      const error =
        payload && "error" in payload && payload.error?.trim()
          ? payload.error.trim()
          : `Codex uplink failed (${response.status}).`;
      return { ok: false, error };
    }

    input.onStream?.(payload.text);
    return { ok: true, text: payload.text };
  }

  const muthurScreenContext = formatMuthurScreenContextForPi(readMuthurScreenSnapshot());
  const glyphContext = await buildGlyphContextSnapshot();
  const piMessages = history.map((entry) => ({
    role: entry.role,
    content: entry.content,
    timestamp: Date.now(),
  }));

  const response = await fetch("/api/pi-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      provider: "opencode",
      model: "big-pickle",
      systemPrompt:
        "You are Pi inhabiting the MUTHUR command console in Echo Mirage Cyberdeck. " +
        "Be technical, direct, and helpful. Each request may include a read-only MUTHUR screen snapshot.",
      muthurScreenContext,
      glyphContext,
      computerUseEnabled: false,
      messages: piMessages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let message = errorText || `Pi uplink failed (${response.status}).`;
    try {
      const parsed = JSON.parse(errorText) as { error?: string };
      if (parsed.error?.trim()) message = parsed.error.trim();
    } catch {
      /* keep raw body */
    }
    return { ok: false, error: message };
  }

  const text = await readPlainTextStream(response, (streamText) => {
    input.onStream?.(streamText);
  });
  return { ok: true, text: text.trim() };
}
