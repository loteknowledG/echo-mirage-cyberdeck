import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { getMuthurOpenAiToolsForPosture } from "@/lib/muthur-core/openai-tool-definitions";
import type { MuthurPosture, MuthurPostureToolContext } from "@/lib/muthur/muthur-posture";
import {
  createMuthurToolExecutionContext,
  type ToolRegistry,
} from "@/lib/muthur-core/types";
import type { MuthurChatJsonMessage } from "@/lib/muthur/chat/muthur-chat-tool-round";
import {
  respondMuthurChatStreamWithoutTools,
  respondMuthurChatWithToolRoundsStream,
} from "@/lib/muthur/chat/muthur-chat-stream-handler";
import type { ProviderReceipt } from "@/lib/server/provider-credentials.server";
import { buildProviderUpstreamHeaders } from "@/lib/server/provider-upstream-headers.server";

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
    return respondMuthurChatStreamWithoutTools({
      endpoint,
      upstreamHeaders,
      model,
      messages: fallbackMessages,
      toolsUsed,
      toolCtx,
      providerReceipt,
    });
  }

  return respondMuthurChatWithToolRoundsStream({
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
  });
}
