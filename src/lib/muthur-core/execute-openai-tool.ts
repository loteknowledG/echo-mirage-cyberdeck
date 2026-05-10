import { formatClockResult, formatJustBashResult, formatLocalFsResult } from "@/lib/muthur-core/format-tool-result";
import type { ToolCall, ToolRegistry } from "@/lib/muthur-core/types";

export async function executeRegistryToolForOpenAi(
  registry: ToolRegistry,
  functionName: string,
  argumentsJson: string,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argumentsJson || "{}") as Record<string, unknown>;
  } catch {
    /* invalid JSON → empty args; tool may error */
  }

  const tool = registry.tools[functionName];
  if (!tool) {
    return `[TOOL ERROR] Unknown function: ${functionName}`;
  }

  const call: ToolCall = { toolName: functionName, args };
  const result = await tool.run(call);

  if (!result.ok) {
    return `[TOOL FAILURE] ${functionName}\n\n${result.error || "Unknown error"}`;
  }

  if (functionName === "localfs") {
    return formatLocalFsResult(result.output);
  }
  if (functionName === "clock") {
    return formatClockResult(result.output);
  }
  return formatJustBashResult(result.output);
}
