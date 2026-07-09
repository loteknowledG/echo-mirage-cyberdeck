import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getMuthurOpenAiToolsForPosture } from "@/lib/muthur-core/openai-tool-definitions";
import { appendMuthurStreamFooters } from "@/lib/muthur-core/muthur-stream-payload";
import { streamOpenAiCompatibleResponse } from "@/lib/muthur-core/stream-openai-response";
import { maybeFinalizeCodingVerify } from "@/lib/muthur-core/coding-verify.server";
import type { MuthurToolExecutionContext, ToolRegistry } from "@/lib/muthur-core/types";
import { isPiControlLeaseGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating";
import type { ProviderReceipt } from "@/lib/server/provider-credentials.server";
import { classifyProviderAuthFailure } from "@/lib/server/provider-credentials.server";
import {
  MUTHUR_CHAT_TOOL_ROUND_TIMEOUT_MS,
  runMuthurChatToolRounds,
  type MuthurChatJsonMessage,
} from "@/lib/muthur/chat/muthur-chat-tool-round";

const textEncoder = new TextEncoder();

export const MUTHUR_CHAT_PLAIN_STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Muthur-Stream": "early",
} as const;

export function shouldTryMuthurChatStreamWithoutTools(status: number): boolean {
  if (status === 401 || status === 403 || status === 404 || status === 429) return false;
  return true;
}

export function mergeMuthurChatReceiptHeaders(
  base: Record<string, string>,
  receipt?: ProviderReceipt,
): Record<string, string> {
  if (!receipt) return base;
  return { ...base, "X-Muthur-Provider-Receipt": JSON.stringify(receipt) };
}

export function muthurChatUpstreamErrorResponse(
  status: number,
  raw: string,
  receipt?: ProviderReceipt,
): Response {
  const detail = formatUplinkErrorDetail(status, raw);
  const headers: Record<string, string> = { ...MUTHUR_CHAT_PLAIN_STREAM_HEADERS };
  if (receipt) {
    headers["X-Muthur-Provider-Receipt"] = JSON.stringify({
      ...receipt,
      auth: "failed",
      reason: classifyProviderAuthFailure(status, raw),
    });
  }
  return new Response(detail, { status, headers });
}

export function muthurChatToolsUsedHeaders(
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

export function startMuthurEarlyUplinkStream(
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
    { headers: { ...MUTHUR_CHAT_PLAIN_STREAM_HEADERS, ...extraHeaders } },
  );
}

export async function pipeMuthurOpenAiStreamToWrite(
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

export async function fetchMuthurChatStreamPlainNoTools(
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

export async function respondMuthurChatStreamWithoutTools(options: {
  endpoint: string;
  upstreamHeaders: Record<string, string>;
  model: string;
  messages: MuthurChatJsonMessage[];
  toolsUsed: string[];
  toolCtx: MuthurToolExecutionContext;
  providerReceipt?: ProviderReceipt;
}): Promise<Response> {
  const { endpoint, upstreamHeaders, model, messages, toolsUsed, toolCtx, providerReceipt } =
    options;
  let streamRes: Response;
  try {
    streamRes = await fetchMuthurChatStreamPlainNoTools(
      endpoint,
      upstreamHeaders,
      model,
      messages,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream request failed";
    return muthurChatUpstreamErrorResponse(502, msg, providerReceipt);
  }
  if (!streamRes.ok) {
    const errText = await streamRes.text().catch(() => "");
    return muthurChatUpstreamErrorResponse(streamRes.status, errText, providerReceipt);
  }
  return new Response(await streamOpenAiCompatibleResponse(streamRes), {
    headers: mergeMuthurChatReceiptHeaders(
      {
        ...MUTHUR_CHAT_PLAIN_STREAM_HEADERS,
        ...muthurChatToolsUsedHeaders(toolsUsed, toolCtx),
      },
      providerReceipt,
    ),
  });
}

export async function respondMuthurChatWithToolRoundsStream(options: {
  endpoint: string;
  upstreamHeaders: Record<string, string>;
  model: string;
  messages: MuthurChatJsonMessage[];
  fallbackMessages: MuthurChatJsonMessage[];
  openAiTools: ReturnType<typeof getMuthurOpenAiToolsForPosture>;
  registry: ToolRegistry;
  toolCtx: MuthurToolExecutionContext;
  toolsUsed: string[];
  providerReceipt?: ProviderReceipt;
}): Promise<Response> {
  const {
    endpoint,
    upstreamHeaders,
    model,
    messages,
    fallbackMessages,
    openAiTools,
    registry,
    toolCtx,
    toolsUsed,
    providerReceipt,
  } = options;

  return startMuthurEarlyUplinkStream(async (write) => {
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
      fetchStreamPlainNoTools: fetchMuthurChatStreamPlainNoTools,
      pipeOpenAiStreamToWrite: pipeMuthurOpenAiStreamToWrite,
      shouldTryStreamWithoutTools: shouldTryMuthurChatStreamWithoutTools,
    });

    if (roundResult.status === "completed") {
      return;
    }

    await maybeFinalizeCodingVerify(toolCtx, write);

    write("⏳ MUTHUR // composing final reply...\n\n");
    const finalRes = await fetchMuthurChatStreamPlainNoTools(
      endpoint,
      upstreamHeaders,
      model,
      messages,
    );
    if (!finalRes.ok) {
      const t = await finalRes.text().catch(() => "");
      throw new Error(formatUplinkErrorDetail(finalRes.status, t));
    }

    await pipeMuthurOpenAiStreamToWrite(finalRes, write);
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
  }, mergeMuthurChatReceiptHeaders({}, providerReceipt));
}
