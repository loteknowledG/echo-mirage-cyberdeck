import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { executeRegistryToolForOpenAi } from "@/lib/muthur-core/execute-openai-tool";
import { MUTHUR_OPENAI_TOOLS } from "@/lib/muthur-core/openai-tool-definitions";
import { streamOpenAiCompatibleResponse } from "@/lib/muthur-core/stream-openai-response";
import type { ToolRegistry } from "@/lib/muthur-core/types";

const textEncoder = new TextEncoder();
const MAX_TOOL_ROUNDS = ENABLE_AUTOMATION ? 4 : 0;

type OpenAiToolCall = {
  id: string;
  type?: string;
  function?: { name: string; arguments: string };
};

type CompletionMessage = {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
};

type JsonMessage = Record<string, unknown>;

const PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

function upstreamErrorResponse(status: number, raw: string): Response {
  const detail = formatUplinkErrorDetail(status, raw);
  return new Response(detail, {
    status,
    headers: PLAIN_HEADERS,
  });
}

function toolsUsedHeaders(toolsUsed: string[]): Record<string, string> {
  if (toolsUsed.length === 0) return {};
  return { "X-Muthur-Tools-Used": toolsUsed.join(", ") };
}

function responsePlainText(text: string, toolsUsed: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(textEncoder.encode(text));
        controller.close();
      },
    }),
    {
      headers: {
        ...PLAIN_HEADERS,
        ...toolsUsedHeaders(toolsUsed),
      },
    },
  );
}

async function fetchStreamPlainNoTools(endpoint: string, apiKey: string, model: string, messages: JsonMessage[]) {
  return fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });
}

/**
 * Model-driven tools: non-stream rounds until assistant returns text or cap;
 * then streams the final completion (after any tool results).
 */
export async function muthurChatWithModelTools(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  /** system + history + user — copied before mutation */
  baseMessages: JsonMessage[];
  registry: ToolRegistry;
}): Promise<Response> {
  const { endpoint, apiKey, model, registry } = options;
  const messages: JsonMessage[] = options.baseMessages.map((m) => ({ ...m }));
  const fallbackMessages = options.baseMessages.map((m) => ({ ...m }));
  const toolsUsed: string[] = [];

  if (!ENABLE_AUTOMATION) {
    let streamRes: Response;
    try {
      streamRes = await fetchStreamPlainNoTools(endpoint, apiKey, model, fallbackMessages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upstream request failed";
      return upstreamErrorResponse(502, msg);
    }
    if (!streamRes.ok) {
      const errText = await streamRes.text().catch(() => "");
      return upstreamErrorResponse(streamRes.status, errText);
    }
    return new Response(await streamOpenAiCompatibleResponse(streamRes), {
      headers: {
        ...PLAIN_HEADERS,
        ...toolsUsedHeaders(toolsUsed),
      },
    });
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        tools: MUTHUR_OPENAI_TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (round === 0) {
        console.warn("[muthur-openai-chat] tools request failed; falling back to stream without tools", res.status);
        const streamRes = await fetchStreamPlainNoTools(endpoint, apiKey, model, fallbackMessages);
        if (!streamRes.ok) {
          const fallbackErr = await streamRes.text().catch(() => "");
          return upstreamErrorResponse(streamRes.status, fallbackErr || errText);
        }
        return new Response(await streamOpenAiCompatibleResponse(streamRes), {
          headers: {
            ...PLAIN_HEADERS,
            ...toolsUsedHeaders(toolsUsed),
          },
        });
      }
      return upstreamErrorResponse(res.status, errText);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: CompletionMessage }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      return new Response(`[MUTHUR] ${data.error.message}`, { status: 502 });
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      return responsePlainText("[MUTHUR] Empty model response.", toolsUsed);
    }

    const toolCalls = msg.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        const n = tc.function?.name?.trim();
        if (n) toolsUsed.push(n);
      }
      console.debug("[muthur-openai-chat] tool round", round, toolCalls.map((tc) => tc.function?.name ?? tc.id));
      messages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: toolCalls,
      });

      const outputs = await Promise.all(
        toolCalls.map(async (tc) => {
          const name = tc.function?.name ?? "";
          const rawArgs = tc.function?.arguments ?? "{}";
          const content = await executeRegistryToolForOpenAi(registry, name, rawArgs);
          return { id: tc.id, content };
        }),
      );

      for (const o of outputs) {
        messages.push({
          role: "tool",
          tool_call_id: o.id,
          content: o.content,
        });
      }
      continue;
    }

    const text = typeof msg.content === "string" ? msg.content : "";
    if (text.trim()) {
      return responsePlainText(text, toolsUsed);
    }

    return responsePlainText("[MUTHUR] Model returned no text.", toolsUsed);
  }

  const finalRes = await fetchStreamPlainNoTools(endpoint, apiKey, model, messages);
  if (!finalRes.ok) {
    const t = await finalRes.text().catch(() => "");
    return upstreamErrorResponse(finalRes.status, t);
  }

  return new Response(await streamOpenAiCompatibleResponse(finalRes), {
    headers: {
      ...PLAIN_HEADERS,
      ...toolsUsedHeaders(toolsUsed),
    },
  });
}
