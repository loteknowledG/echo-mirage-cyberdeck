import { getMuthurExecutionLoop } from "./execution-loop";
import { formatExecutionResultsForOpenAiTool, openAiToolCallToAction } from "./tool-bridge";
import { executeRegistryToolForOpenAi } from "@/lib/muthur-core/execute-openai-tool";
import type { ToolRegistry } from "@/lib/muthur-core/types";
import { auditExecutionSession } from "./audit-log";

export async function executeOpenAiToolViaExecutionLoop(
  registry: ToolRegistry,
  functionName: string,
  argumentsJson: string,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argumentsJson || "{}") as Record<string, unknown>;
  } catch {
    /* invalid JSON */
  }

  const mapped = openAiToolCallToAction(functionName, args);
  if (!mapped) {
    await auditExecutionSession({
      event: "registry_fallback",
      function: functionName,
    });
    return executeRegistryToolForOpenAi(registry, functionName, argumentsJson);
  }

  const loop = getMuthurExecutionLoop();
  const snapshotBefore = loop.getState();
  const useExecuteMode = snapshotBefore.execution_mode === "observe" ? "execute" : snapshotBefore.execution_mode;
  if (useExecuteMode !== snapshotBefore.execution_mode) {
    loop.setMode(useExecuteMode);
  }

  const created = loop.enqueue([mapped], { taskLabel: `openai:${functionName}` });
  await loop.waitForIdle(120_000);

  const state = loop.getState();
  const action = state.completed_actions.find((item) => item.id === created[0]?.id);
  if (!action) {
    const blocked = state.queue.find((item) => item.id === created[0]?.id);
    if (blocked?.status === "blocked") {
      return formatExecutionResultsForOpenAiTool(functionName, blocked);
    }
    return `[TOOL ERROR] ${functionName}\n\nExecution loop did not produce a result.`;
  }

  return formatExecutionResultsForOpenAiTool(functionName, action);
}
