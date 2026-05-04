import { NextResponse } from "next/server";
import type { Message, TextContent, ThinkingContent, ToolCall, ImageContent } from "@mariozechner/pi-ai";

const textEncoder = new TextEncoder();

const CHAT_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

const DEFAULT_PROVIDER_KEY_ENV: Record<string, string | undefined> = {
  opencode: process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.NEXT_PUBLIC_ZEN_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): string {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) {
    return suppliedApiKey.trim();
  }
  const envKey = DEFAULT_PROVIDER_KEY_ENV[provider];
  if (typeof envKey === "string" && envKey.trim()) {
    return envKey.trim();
  }
  return "";
}

function flattenTextContent(content: Array<TextContent | ThinkingContent | ToolCall | ImageContent>) {
  return content
    .map((item) => {
      if (item.type === "text") return item.text;
      if (item.type === "thinking") return item.thinking;
      if (item.type === "toolCall") return `${item.name}(${JSON.stringify(item.arguments)})`;
      if (item.type === "image") return "[image]";
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function toOpenAiMessages(systemPrompt: string | undefined, messages: Message[]) {
  const normalized: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string }> = [];

  if (systemPrompt?.trim()) {
    normalized.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const message of messages) {
    if (message.role === "user") {
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content
              .map((item) => (item.type === "text" ? item.text : item.type === "image" ? "[image]" : ""))
              .filter(Boolean)
              .join("\n\n")
              .trim();
      if (content) normalized.push({ role: "user", content });
      continue;
    }

    if (message.role === "assistant") {
      const content = flattenTextContent(message.content);
      if (content) normalized.push({ role: "assistant", content });
      continue;
    }

    if (message.role === "toolResult") {
      const content = message.content
        .map((item) => (item.type === "text" ? item.text : item.type === "image" ? "[image]" : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (content) {
        normalized.push({
          role: "tool",
          content,
          tool_call_id: message.toolCallId,
        });
      }
    }
  }

  return normalized;
}

async function streamOpenAiCompatibleResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = response.body;

  if (!body) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  if (!contentType.includes("text/event-stream")) {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) controller.enqueue(textEncoder.encode(text));
          }
          const rest = decoder.decode();
          if (rest) controller.enqueue(textEncoder.encode(rest));
        } finally {
          controller.close();
        }
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(textEncoder.encode(text));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              emit(content);
            } catch {
              // Ignore malformed chunks.
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = typeof body.provider === "string" ? body.provider : "opencode";
    const endpoint = CHAT_URL[provider];
    console.debug("[api/pi-chat] incoming", {
      provider,
      model: body.model,
      messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    });

    if (!endpoint) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    const apiKey = resolveProviderApiKey(provider, body.apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : undefined;
    const messages = Array.isArray(body.messages) ? (body.messages as Message[]) : [];
    const model =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : "trinity-large-preview-free";

    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(systemPrompt, messages),
        stream: true,
      }),
    });

    console.debug("[api/pi-chat] upstream", providerResponse.status);

    if (!providerResponse.ok) {
      const text = await providerResponse.text().catch(() => "");
      return NextResponse.json({ error: `API error ${providerResponse.status}: ${text}` }, { status: 502 });
    }

    return new Response(await streamOpenAiCompatibleResponse(providerResponse), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/pi-chat][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
