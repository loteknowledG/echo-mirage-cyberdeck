import { getMuthurExecutionLoop } from "./execution-loop";
import { formatExecutionResultsForOpenAiTool, openAiToolCallToAction } from "./tool-bridge";
import { executeRegistryToolForOpenAi } from "@/lib/muthur-core/execute-openai-tool";
import type { ToolRegistry } from "@/lib/muthur-core/types";
import { auditExecutionSession } from "./audit-log";
import { recordExecutionLoopHealth, recordFailure, recordProviderHealth } from "@/lib/muthur/health";

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
  const readOnlyObservation = mapped.type === "observe_operator_pane";
  const useExecuteMode =
    snapshotBefore.execution_mode === "observe" && !readOnlyObservation
      ? "execute"
      : snapshotBefore.execution_mode;
  if (useExecuteMode !== snapshotBefore.execution_mode) {
    loop.setMode(useExecuteMode);
  }

  const created = loop.enqueue([mapped], { taskLabel: `openai:${functionName}` });
  let timedOut = false;
  try {
    await loop.waitForIdle(120_000);
  } catch (timeoutErr) {
    timedOut = true;
    console.warn(`[execute-openai-tool] waitForIdle timeout for ${functionName}, forcing recovery`);
    loop.forceRecover();
  }

  if (timedOut) {
    recordExecutionLoopHealth({ status: "failed", lastError: `Tool ${functionName} timed out after 120s` });
    return `[TOOL TIMEOUT] ${functionName}\n\nExecution timed out after 120 seconds. The loop has been recovered and is ready for retry. Please try again.`;
  }

  const state = loop.getState();
  const action = state.completed_actions.find((item) => item.id === created[0]?.id);
  if (!action) {
    const blocked = state.queue.find((item) => item.id === created[0]?.id);
    if (blocked?.status === "blocked") {
      recordProviderHealth({ status: "degraded", lastError: "Tool blocked - awaiting operator approval" });
      return formatExecutionResultsForOpenAiTool(functionName, blocked);
    }
    recordExecutionLoopHealth({ status: "degraded", lastError: "No result from execution loop" });
    return `[TOOL ERROR] ${functionName}\n\nExecution loop did not produce a result.`;
  }

  recordProviderHealth({ status: action.status === "completed" ? "healthy" : "degraded", lastError: action.error ?? null });
  return formatExecutionResultsForOpenAiTool(functionName, action);
}
