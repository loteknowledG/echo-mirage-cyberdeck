import {
  formatClockResult,
  formatConvertDocumentResult,
  formatExportMarkdownToDocxResult,
  formatExportMarkdownToPdfResult,
  formatGitDiffResult,
  formatGitStatusResult,
  formatJustBashResult,
  formatLocalFsResult,
  formatObserveOperatorPaneResult,
  formatSuggestOperatorEditResult,
  formatWorkspaceExecResult,
} from "@/lib/muthur-core/format-tool-result";
import { extractOperatorEditFromToolOutput } from "@/lib/muthur-core/suggest-operator-edit";
import { extractOperatorConversionRef } from "@/lib/muthur-core/operator-conversion-ref";
import type { MuthurToolExecutionContext, ToolCall, ToolRegistry } from "@/lib/muthur-core/types";

/** MUTHUR chat hot path — run tools directly, no execution-loop allowlist or approval gates. */
export async function executeMuthurChatTool(
  registry: ToolRegistry,
  functionName: string,
  argumentsJson: string,
  ctx?: MuthurToolExecutionContext,
): Promise<string> {
  return executeRegistryToolForOpenAi(registry, functionName, argumentsJson, ctx);
}

export async function executeRegistryToolForOpenAi(
  registry: ToolRegistry,
  functionName: string,
  argumentsJson: string,
  ctx?: MuthurToolExecutionContext,
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
  if (functionName === "observe_operator_pane") {
    return formatObserveOperatorPaneResult(result.output);
  }
  if (functionName === "clock") {
    return formatClockResult(result.output);
  }
  if (functionName === "convert_document_to_markdown") {
    if (result.ok && ctx) {
      const conversion = extractOperatorConversionRef(result.output);
      if (conversion) ctx.operatorConversion = conversion;
    }
    return formatConvertDocumentResult(result.output);
  }
  if (functionName === "export_markdown_to_docx") {
    return formatExportMarkdownToDocxResult(result.output);
  }
  if (functionName === "export_markdown_to_pdf") {
    return formatExportMarkdownToPdfResult(result.output);
  }
  if (functionName === "suggest_operator_edit") {
    if (result.ok && ctx?.operatorEdits) {
      const edit = extractOperatorEditFromToolOutput(result.output);
      if (edit) ctx.operatorEdits.push(edit);
    }
    return formatSuggestOperatorEditResult(result.output);
  }
  if (functionName === "workspace_exec") {
    return formatWorkspaceExecResult(result.output);
  }
  if (functionName === "git_status") {
    return formatGitStatusResult(result.output);
  }
  if (functionName === "git_diff") {
    return formatGitDiffResult(result.output);
  }
  return formatJustBashResult(result.output);
}
