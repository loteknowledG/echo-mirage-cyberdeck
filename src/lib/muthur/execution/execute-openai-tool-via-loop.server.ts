import { executeMuthurChatTool } from "@/lib/muthur-core/execute-openai-tool";
import type { ToolRegistry, MuthurToolExecutionContext } from "@/lib/muthur-core/types";

/**
 * @deprecated MUTHUR chat uses executeMuthurChatTool (direct registry). Execution loop
 * remains for card-table / verification UI only — not the chat hot path.
 */
export async function executeOpenAiToolViaExecutionLoop(
  registry: ToolRegistry,
  functionName: string,
  argumentsJson: string,
  ctx?: MuthurToolExecutionContext,
): Promise<string> {
  return executeMuthurChatTool(registry, functionName, argumentsJson, ctx);
}
