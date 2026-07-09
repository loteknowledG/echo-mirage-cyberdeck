import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getMuthurOpenAiToolsForPosture } from "@/lib/muthur-core/openai-tool-definitions";
import type { MuthurPosture, MuthurPostureToolContext } from "@/lib/muthur/muthur-posture";
import { isPiControlLeaseGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating";
import { appendMuthurStreamFooters } from "@/lib/muthur-core/muthur-stream-payload";
import { streamOpenAiCompatibleResponse } from "@/lib/muthur-core/stream-openai-response";
import { maybeFinalizeCodingVerify } from "@/lib/muthur-core/coding-verify.server";
import {
  createMuthurToolExecutionContext,
  type MuthurToolExecutionContext,
  type ToolRegistry,
} from "@/lib/muthur-core/types";
import {
  MUTHUR_CHAT_TOOL_ROUND_TIMEOUT_MS,
  runMuthurChatToolRounds,
  type MuthurChatJsonMessage,
} from "@/lib/muthur/chat/muthur-chat-tool-round";

const textEncoder = new TextEncoder();

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

import type { ProviderReceipt } from "@/lib/server/provider-credentials.server";
import { classifyProviderAuthFailure } from "@/lib/server/provider-credentials.server";
import { buildProviderUpstreamHeaders } from "@/lib/server/provider-upstream-headers.server";

function upstreamErrorResponse(status: number, raw: string, receipt?: ProviderReceipt): Response {
  const detail = formatUplinkErrorDetail(status, raw);
  const headers: Record<string, string> = { ...PLAIN_HEADERS };
  if (receipt) {
    headers["X-Muthur-Provider-Receipt"] = JSON.stringify({
      ...receipt,
      auth: "failed",
      reason: classifyProviderAuthFailure(status, raw),
    });
  }
  return new Response(detail, { status, headers });
}

function mergeReceiptHeaders(
  base: Record<string, string>,
  receipt?: ProviderReceipt,
): Record<string, string> {
  if (!receipt) return base;
  return { ...base, "X-Muthur-Provider-Receipt": JSON.stringify(receipt) };
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
  if (toolCtx.operatorBrowser) {
    headers["X-Muthur-Operator-Browser"] = JSON.stringify(toolCtx.operatorBrowser);
  }
  if (toolCtx.surveyAutoConnect) {
    headers["X-Muthur-Survey-Auto-Connect"] = JSON.stringify(toolCtx.surveyAutoConnect);
  }
  if (toolCtx.codingVerify) {
    headers["X-Muthur-Coding-Verify"] = JSON.stringify(toolCtx.codingVerify);
  }
  if (isPiControlLeaseGatingEnabled() && toolCtx.piControlLeaseRequest) {
    headers["X-Muthur-Pi-Control-Request"] = JSON.stringify(toolCtx.piControlLeaseRequest);
  }
  return headers;
}

function startEarlyUplinkStream(
  run: (write: (chunk: string) => void) => Promise<void>,
  extraHeaders?: Record<string, string>,
): Response {
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
          write(`\n${msg}`);
          controller.close();
        }
      },
    }),
    { headers: { ...PLAIN_HEADERS, ...extraHeaders } },
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

async function fetchStreamPlainNoTools(
  endpoint: string,
  headers: Record<string, string>,
  model: string,
  messages: MuthurChatJsonMessage[],
) {
  return fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    },
    MUTHUR_CHAT_TOOL_ROUND_TIMEOUT_MS,
  );
}

function inferProviderIdFromEndpoint(endpoint: string): string {
  if (endpoint.includes("openrouter.ai")) return "openrouter";
  if (endpoint.includes("opencode.ai")) return "opencode";
  if (endpoint.includes("api.openai.com")) return "openai";
  return "openai";
}

/**
 * Model-driven tools: stream uplink progress immediately, run tool rounds, then final text.
 */
export async function muthurChatWithModelTools(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  baseMessages: MuthurChatJsonMessage[];
  registry: ToolRegistry;
  /** When false, stream a direct reply with no tool definitions (greetings, small talk). */
  toolsEnabled?: boolean;
  posture?: MuthurPosture;
  commanderMissionActive?: boolean;
  providerReceipt?: ProviderReceipt;
  providerId?: string;
}): Promise<Response> {
  const { endpoint, apiKey, model, registry, providerReceipt } = options;
  const providerId = options.providerId ?? inferProviderIdFromEndpoint(endpoint);
  const upstreamHeaders = buildProviderUpstreamHeaders(providerId, apiKey);
  const posture = options.posture ?? "plan";
  const toolContext: MuthurPostureToolContext | undefined =
    typeof options.commanderMissionActive === "boolean"
      ? { missionActive: options.commanderMissionActive }
      : undefined;
  const openAiTools = getMuthurOpenAiToolsForPosture(posture, toolContext);
  const toolsEnabled =
    options.toolsEnabled !== false &&
    ENABLE_AUTOMATION &&
    Object.keys(registry.tools).length > 0 &&
    openAiTools.length > 0;
  const messages: MuthurChatJsonMessage[] = options.baseMessages.map((m) => ({ ...m }));
  const fallbackMessages = options.baseMessages.map((m) => ({ ...m }));
  const toolsUsed: string[] = [];
  const toolCtx = createMuthurToolExecutionContext(posture, {
    commanderMissionActive: options.commanderMissionActive,
  });

  if (!toolsEnabled) {
    let streamRes: Response;
    try {
      streamRes = await fetchStreamPlainNoTools(endpoint, upstreamHeaders, model, fallbackMessages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upstream request failed";
      return upstreamErrorResponse(502, msg, providerReceipt);
    }
    if (!streamRes.ok) {
      const errText = await streamRes.text().catch(() => "");
      return upstreamErrorResponse(streamRes.status, errText, providerReceipt);
    }
    return new Response(await streamOpenAiCompatibleResponse(streamRes), {
      headers: mergeReceiptHeaders(
        {
          ...PLAIN_HEADERS,
          ...toolsUsedHeaders(toolsUsed, toolCtx),
        },
        providerReceipt,
      ),
    });
  }

  return startEarlyUplinkStream(async (write) => {
    write("⏳ MUTHUR // uplink active...\n\n");

    const roundResult = await runMuthurChatToolRounds({
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
    });

    if (roundResult.status === "completed") {
      return;
    }

    await maybeFinalizeCodingVerify(toolCtx, write);

    write("⏳ MUTHUR // composing final reply...\n\n");
    const finalRes = await fetchStreamPlainNoTools(endpoint, upstreamHeaders, model, messages);
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
        toolCtx.operatorBrowser,
        toolCtx.surveyAutoConnect,
      ),
    );
  }, mergeReceiptHeaders({}, providerReceipt));
}
