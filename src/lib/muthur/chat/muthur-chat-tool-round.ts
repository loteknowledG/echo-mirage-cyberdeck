import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { maybeFinalizeCodingVerify } from "@/lib/muthur-core/coding-verify.server";
import { executeMuthurChatTool } from "@/lib/muthur-core/execute-openai-tool";
import {
  extractOpenAiAssistantVisibleContent,
  extractOpenAiMessageReasoning,
  extractOpenAiMessageText,
} from "@/lib/muthur-core/extract-openai-message-text";
import { getMuthurOpenAiToolsForPosture } from "@/lib/muthur-core/openai-tool-definitions";
import {
  inlineCallsToOpenAiToolCalls,
  parseInlineToolCalls,
  stripInlineToolMarkup,
} from "@/lib/muthur-core/parse-inline-tool-calls";
import { appendMuthurReasoningStreamDelta } from "@/lib/muthur-core/muthur-stream-reasoning";
import { appendMuthurStreamFooters } from "@/lib/muthur-core/muthur-stream-payload";
import { formatPiControlLeaseStreamMarker } from "@/lib/muthur/control/pi-control-lease-stream";
import { isPiControlLeaseGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating";
import type { MuthurToolExecutionContext, ToolRegistry } from "@/lib/muthur-core/types";

export const MAX_MUTHUR_CHAT_TOOL_ROUNDS = ENABLE_AUTOMATION ? 4 : 0;
/** Tool rounds may chain several upstream completions; allow extra headroom per hop. */
export const MUTHUR_CHAT_TOOL_ROUND_TIMEOUT_MS = 180_000;

export type MuthurChatJsonMessage = Record<string, unknown>;

type OpenAiToolCall = {
  id: string;
  type?: string;
  function?: { name: string; arguments: string };
};

type CompletionMessage = {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  reasoning_content?: string | null;
  reasoning?: string | null;
};

export type RunMuthurChatToolRoundsOptions = {
  endpoint: string;
  upstreamHeaders: Record<string, string>;
  model: string;
  messages: MuthurChatJsonMessage[];
  fallbackMessages: MuthurChatJsonMessage[];
  openAiTools: ReturnType<typeof getMuthurOpenAiToolsForPosture>;
  registry: ToolRegistry;
  toolCtx: MuthurToolExecutionContext;
  toolsUsed: string[];
  write: (chunk: string) => void;
  fetchStreamPlainNoTools: (
    endpoint: string,
    headers: Record<string, string>,
    model: string,
    messages: MuthurChatJsonMessage[],
  ) => Promise<Response>;
  pipeOpenAiStreamToWrite: (
    streamRes: Response,
    write: (chunk: string) => void,
  ) => Promise<void>;
  shouldTryStreamWithoutTools: (status: number) => boolean;
};

export type RunMuthurChatToolRoundsResult =
  | { status: "completed" }
  | { status: "final_stream" };

/**
 * Model-driven tool rounds: non-stream upstream completions, tool execution, early text exit.
 * Caller composes the final plain stream when status is `final_stream`.
 */
export async function runMuthurChatToolRounds({
  endpoint,
  upstreamHeaders,
  model,
  messages,
  fallbackMessages,
  openAiTools,
  registry,
  toolCtx,
  toolsUsed,
  write,
  fetchStreamPlainNoTools,
  pipeOpenAiStreamToWrite,
  shouldTryStreamWithoutTools,
}: RunMuthurChatToolRoundsOptions): Promise<RunMuthurChatToolRoundsResult> {
  for (let round = 0; round < MAX_MUTHUR_CHAT_TOOL_ROUNDS; round++) {
    write(`⏳ MUTHUR // thinking (round ${round + 1})...\n`);

    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          tools: openAiTools,
          tool_choice: "auto",
        }),
      },
      MUTHUR_CHAT_TOOL_ROUND_TIMEOUT_MS,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (round === 0 && shouldTryStreamWithoutTools(res.status)) {
        console.warn("[muthur-openai-chat] tools request failed; falling back to stream without tools", res.status);
        write("⏳ MUTHUR // falling back to direct reply...\n\n");
        const streamRes = await fetchStreamPlainNoTools(endpoint, upstreamHeaders, model, fallbackMessages);
        if (!streamRes.ok) {
          const fallbackErr = await streamRes.text().catch(() => "");
          throw new Error(formatUplinkErrorDetail(streamRes.status, fallbackErr || errText));
        }
        await pipeOpenAiStreamToWrite(streamRes, write);
        return { status: "completed" };
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
          toolCtx.operatorBrowser,
          toolCtx.surveyAutoConnect,
        ),
      );
      return { status: "completed" };
    }

    const reasoningContent = extractOpenAiMessageReasoning(msg);
    if (reasoningContent) {
      write(appendMuthurReasoningStreamDelta(reasoningContent));
    }

    let toolCalls = msg.tool_calls;
    const rawContent =
      extractOpenAiAssistantVisibleContent(msg) || extractOpenAiMessageText(msg);
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      const inlineCalls = parseInlineToolCalls(rawContent);
      if (inlineCalls.length > 0) {
        write(`⏳ MUTHUR // parsed inline tools: ${inlineCalls.map((c) => c.name).join(", ")}\n`);
        toolCalls = inlineCallsToOpenAiToolCalls(inlineCalls);
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
      const operatorBrowserCalls = toolCalls.filter((tc) => tc.function?.name === "operator_browser");
      if (operatorBrowserCalls.length > 0) {
        const snapshotCalls = operatorBrowserCalls.filter((tc) => {
          try {
            const args = JSON.parse(tc.function?.arguments ?? "{}") as { action?: string };
            return (args.action ?? "goto").toLowerCase() === "snapshot";
          } catch {
            return false;
          }
        });
        const totalBrowserTools = toolsUsed.filter((name) => name === "operator_browser").length;
        if (snapshotCalls.length > 0 && totalBrowserTools >= 2) {
          messages.push({
            role: "user",
            content:
              "You already received operator_browser LIVE PAGE text or a LIVE FETCH failure. " +
              "Do not call operator_browser again. Reply with plain text now.",
          });
        }
      }
      if (isPiControlLeaseGatingEnabled() && toolCtx.piControlLeaseRequest) {
        write(formatPiControlLeaseStreamMarker(toolCtx.piControlLeaseRequest));
      }
      continue;
    }

    await maybeFinalizeCodingVerify(toolCtx, write);

    const text = stripInlineToolMarkup(rawContent);
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
          toolCtx.operatorBrowser,
          toolCtx.surveyAutoConnect,
        ),
      );
      return { status: "completed" };
    }

    if (round + 1 < MAX_MUTHUR_CHAT_TOOL_ROUNDS) {
      write("⏳ MUTHUR // empty model turn — retrying with tool nudge...\n");
      messages.push({
        role: "assistant",
        content: rawContent.trim() ? rawContent : null,
      });
      messages.push({
        role: "user",
        content:
          "Your last reply had no executable tool calls and no visible text. " +
          "Call real tools now (e.g. localfs mkdir + localfs write) or reply with plain text explaining the next step.",
      });
      continue;
    }

    write("⏳ MUTHUR // empty model turn — composing final reply...\n\n");
    break;
  }

  return { status: "final_stream" };
}
