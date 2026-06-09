import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { executeMuthurChatTool } from "@/lib/muthur-core/execute-openai-tool";
import { MUTHUR_OPENAI_TOOLS } from "@/lib/muthur-core/openai-tool-definitions";
import { appendMuthurStreamFooters } from "@/lib/muthur-core/muthur-stream-payload";
import { dsmlCallsToOpenAiToolCalls, parseDsmlToolCalls, stripDsmlToolMarkup } from "@/lib/muthur-core/parse-dsml-tool-calls";
import { streamOpenAiCompatibleResponse } from "@/lib/muthur-core/stream-openai-response";
import { maybeFinalizeCodingVerify } from "@/lib/muthur-core/coding-verify.server";
import {
  createMuthurToolExecutionContext,
  type MuthurToolExecutionContext,
  type ToolRegistry,
} from "@/lib/muthur-core/types";

const textEncoder = new TextEncoder();
const MAX_TOOL_ROUNDS = ENABLE_AUTOMATION ? 4 : 0;
/** Tool rounds may chain several upstream completions; allow extra headroom per hop. */
const UPSTREAM_TOOL_TIMEOUT_MS = 180_000;

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
  "X-Muthur-Stream": "early",
} as const;

function shouldTryStreamWithoutTools(status: number): boolean {
  if (status === 401 || status === 403 || status === 404 || status === 429) return false;
  return true;
}

function upstreamErrorResponse(status: number, raw: string): Response {
  const detail = formatUplinkErrorDetail(status, raw);
  return new Response(detail, {
    status,
    headers: PLAIN_HEADERS,
  });
}

function toolsUsedHeaders(
  toolsUsed: string[],
  toolCtx: MuthurToolExecutionContext,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (toolsUsed.length > 0) {
    headers["X-Muthur-Tools-Used"] = toolsUsed.join(", ");
  }
  if (toolCtx.operatorEdits.length > 0) {
    headers["X-Muthur-Operator-Edits"] = JSON.stringify(toolCtx.operatorEdits);
  }
  if (toolCtx.operatorConversion) {
    headers["X-Muthur-Operator-Conversion"] = JSON.stringify(toolCtx.operatorConversion);
  }
  if (toolCtx.operatorOpenFile) {
    headers["X-Muthur-Operator-Open"] = JSON.stringify(toolCtx.operatorOpenFile);
  }
  if (toolCtx.codingVerify) {
    headers["X-Muthur-Coding-Verify"] = JSON.stringify(toolCtx.codingVerify);
  }
  return headers;
}

function startEarlyUplinkStream(run: (write: (chunk: string) => void) => Promise<void>): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (chunk: string) => {
          controller.enqueue(textEncoder.encode(chunk));
        };
        try {
          await run(write);
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Uplink failed";
          write(`\n[MUTHUR] ${msg}`);
          controller.close();
        }
      },
    }),
    { headers: PLAIN_HEADERS },
  );
}

async function pipeOpenAiStreamToWrite(
  streamRes: Response,
  write: (chunk: string) => void,
): Promise<void> {
  const body = await streamOpenAiCompatibleResponse(streamRes);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    write(decoder.decode(value, { stream: true }));
  }
}

async function fetchStreamPlainNoTools(endpoint: string, apiKey: string, model: string, messages: JsonMessage[]) {
  return fetchWithTimeout(
    endpoint,
    {
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
    },
    UPSTREAM_TOOL_TIMEOUT_MS,
  );
}

/**
 * Model-driven tools: stream uplink progress immediately, run tool rounds, then final text.
 */
export async function muthurChatWithModelTools(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  baseMessages: JsonMessage[];
  registry: ToolRegistry;
  /** When false, stream a direct reply with no tool definitions (greetings, small talk). */
  toolsEnabled?: boolean;
}): Promise<Response> {
  const { endpoint, apiKey, model, registry } = options;
  const toolsEnabled =
    options.toolsEnabled !== false &&
    ENABLE_AUTOMATION &&
    Object.keys(registry.tools).length > 0;
  const messages: JsonMessage[] = options.baseMessages.map((m) => ({ ...m }));
  const fallbackMessages = options.baseMessages.map((m) => ({ ...m }));
  const toolsUsed: string[] = [];
  const toolCtx = createMuthurToolExecutionContext();

  if (!toolsEnabled) {
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
        ...toolsUsedHeaders(toolsUsed, toolCtx),
      },
    });
  }

  return startEarlyUplinkStream(async (write) => {
    write("⏳ MUTHUR // uplink active...\n\n");

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      write(`⏳ MUTHUR // thinking (round ${round + 1})...\n`);

      const res = await fetchWithTimeout(
        endpoint,
        {
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
        },
        UPSTREAM_TOOL_TIMEOUT_MS,
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (round === 0 && shouldTryStreamWithoutTools(res.status)) {
          console.warn("[muthur-openai-chat] tools request failed; falling back to stream without tools", res.status);
          write("⏳ MUTHUR // falling back to direct reply...\n\n");
          const streamRes = await fetchStreamPlainNoTools(endpoint, apiKey, model, fallbackMessages);
          if (!streamRes.ok) {
            const fallbackErr = await streamRes.text().catch(() => "");
            throw new Error(formatUplinkErrorDetail(streamRes.status, fallbackErr || errText));
          }
          await pipeOpenAiStreamToWrite(streamRes, write);
          return;
        }
        throw new Error(formatUplinkErrorDetail(res.status, errText));
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: CompletionMessage }>;
        error?: { message?: string };
      };

      if (data.error?.message) {
        throw new Error(data.error.message);
      }

      const msg = data.choices?.[0]?.message;
      if (!msg) {
        write(
          appendMuthurStreamFooters(
            "[MUTHUR] Empty model response.",
            toolsUsed,
            toolCtx.operatorEdits,
            toolCtx.operatorConversion,
            toolCtx.operatorOpenFile,
            toolCtx.codingVerify,
          ),
        );
        return;
      }

      let toolCalls = msg.tool_calls;
      const rawContent = typeof msg.content === "string" ? msg.content : "";
      if ((!Array.isArray(toolCalls) || toolCalls.length === 0) && rawContent.includes("DSML")) {
        const dsmlCalls = parseDsmlToolCalls(rawContent);
        if (dsmlCalls.length > 0) {
          write(`⏳ MUTHUR // parsed DSML tools: ${dsmlCalls.map((c) => c.name).join(", ")}\n`);
          toolCalls = dsmlCallsToOpenAiToolCalls(dsmlCalls);
        }
      }

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        const names = toolCalls
          .map((tc) => tc.function?.name?.trim())
          .filter(Boolean)
          .join(", ");
        write(`⏳ MUTHUR // tools: ${names}\n`);
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
            const content = await executeMuthurChatTool(registry, name, rawArgs, toolCtx);
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

      await maybeFinalizeCodingVerify(toolCtx, write);

      const text = stripDsmlFromAssistantText(rawContent);
      if (text.trim()) {
        write("\n");
        write(
          appendMuthurStreamFooters(
            text,
            toolsUsed,
            toolCtx.operatorEdits,
            toolCtx.operatorConversion,
            toolCtx.operatorOpenFile,
            toolCtx.codingVerify,
          ),
        );
        return;
      }

      write(
        appendMuthurStreamFooters(
          "[MUTHUR] Model returned no text.",
          toolsUsed,
          toolCtx.operatorEdits,
          toolCtx.operatorConversion,
          toolCtx.operatorOpenFile,
          toolCtx.codingVerify,
        ),
      );
      return;
    }

    await maybeFinalizeCodingVerify(toolCtx, write);

    write("⏳ MUTHUR // composing final reply...\n\n");
    const finalRes = await fetchStreamPlainNoTools(endpoint, apiKey, model, messages);
    if (!finalRes.ok) {
      const t = await finalRes.text().catch(() => "");
      throw new Error(formatUplinkErrorDetail(finalRes.status, t));
    }

    await pipeOpenAiStreamToWrite(finalRes, write);
    write(
      appendMuthurStreamFooters(
        "",
        toolsUsed,
        toolCtx.operatorEdits,
        toolCtx.operatorConversion,
        toolCtx.operatorOpenFile,
        toolCtx.codingVerify,
      ),
    );
  });
}

function stripDsmlFromAssistantText(text: string): string {
  return stripDsmlToolMarkup(text);
}
