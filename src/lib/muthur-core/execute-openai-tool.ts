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
  formatOpenOperatorFileResult,
  formatOperatorBrowserResult,
  formatSuggestOperatorEditResult,
  formatSamusHandsEyesResult,
  formatSurveyAutoConnectResult,
  formatCallStationResult,
  formatWorkspaceExecResult,
} from "@/lib/muthur-core/format-tool-result";
import { extractOperatorEditFromToolOutput } from "@/lib/muthur-core/suggest-operator-edit";
import { recordCodingTouch } from "@/lib/muthur-core/coding-touch";
import { extractOperatorBrowserRef } from "@/lib/muthur-core/operator-browser-ref";
import { extractOperatorConversionRef } from "@/lib/muthur-core/operator-conversion-ref";
import { extractOperatorOpenRef } from "@/lib/muthur-core/operator-open-file-ref";
import { extractSurveyAutoConnectRef } from "@/lib/muthur-core/survey-auto-connect-ref";
import { formatBlockedToolMessage, isToolAllowedForPosture, type MuthurPostureToolContext } from "@/lib/muthur/muthur-posture";
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

  const posture = ctx?.posture ?? "plan";
  const toolContext: MuthurPostureToolContext | undefined =
    typeof ctx?.commanderMissionActive === "boolean"
      ? { missionActive: ctx.commanderMissionActive }
      : undefined;
  if (!isToolAllowedForPosture(posture, functionName, toolContext)) {
    return formatBlockedToolMessage(posture, functionName, toolContext);
  }

  const call: ToolCall = { toolName: functionName, args, executionContext: ctx };
  const result = await tool.run(call);

  if (!result.ok) {
    return `[TOOL FAILURE] ${functionName}\n\n${result.error || "Unknown error"}`;
  }

  recordCodingTouch(ctx, functionName, args, result.output);

  if (functionName === "localfs") {
    return formatLocalFsResult(result.output);
  }
  if (functionName === "observe_operator_pane") {
    return formatObserveOperatorPaneResult(result.output);
  }
  if (functionName === "open_operator_file") {
    if (result.ok && ctx) {
      const openRef = extractOperatorOpenRef(result.output);
      if (openRef) ctx.operatorOpenFile = openRef;
    }
    return formatOpenOperatorFileResult(result.output);
  }
  if (functionName === "operator_browser") {
    if (result.ok && ctx) {
      const browserRef = extractOperatorBrowserRef(result.output);
      if (browserRef) ctx.operatorBrowser = browserRef;
    }
    return formatOperatorBrowserResult(result.output);
  }
  if (functionName === "survey_auto_connect") {
    if (result.ok && ctx) {
      const surveyRef = extractSurveyAutoConnectRef(result.output);
      if (surveyRef) ctx.surveyAutoConnect = surveyRef;
    }
    return formatSurveyAutoConnectResult(result.output);
  }
  if (
    functionName === "call_station_who_is_waiting" ||
    functionName === "call_station_open_room" ||
    functionName === "call_station_match" ||
    functionName === "call_station_find_room"
  ) {
    return formatCallStationResult(result.output);
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
  if (functionName === "pi_computer_use") {
    return JSON.stringify(result.output, null, 2);
  }
  if (functionName === "samus_hands_eyes") {
    return formatSamusHandsEyesResult(result.output);
  }
  if (
    functionName === "calyx_search" ||
    functionName === "calyx_ingest" ||
    functionName === "calyx_kernel_answer"
  ) {
    return JSON.stringify(result.output, null, 2);
  }
  return formatJustBashResult(result.output);
}
