/** MUTHUR composer uplink modes — autonomy, tools, and disk commit policy. */

import { isCasualMuthurChat } from "@/lib/muthur-core/muthur-chat-intent";

export type MuthurUplinkMode = "ask" | "plan" | "agent" | "debug";

export type MuthurUplinkCommitPolicy = "never" | "manual" | "immediate";

export const MUTHUR_UPLINK_MODE_STORAGE_KEY = "echo-mirage-muthur-uplink-mode-v1";

export type MuthurUplinkModeMeta = {
  id: MuthurUplinkMode;
  label: string;
  title: string;
  internalMode: "OBSERVE" | "ASSIST" | "USE";
  commit: MuthurUplinkCommitPolicy;
};

export const MUTHUR_UPLINK_MODES: MuthurUplinkModeMeta[] = [
  {
    id: "ask",
    label: "Ask",
    title: "Interrogate — clarify intent with questions (read-only)",
    internalMode: "OBSERVE",
    commit: "never",
  },
  {
    id: "plan",
    label: "Plan",
    title: "Brainstorm — discuss approach, no edits or file creation",
    internalMode: "ASSIST",
    commit: "never",
  },
  {
    id: "agent",
    label: "Agent",
    title: "Execute — edit operator pane and auto-save to disk",
    internalMode: "USE",
    commit: "immediate",
  },
  {
    id: "debug",
    label: "Debug",
    title: "Patch — edit operator pane, operator saves disk",
    internalMode: "ASSIST",
    commit: "manual",
  },
];

const DEFAULT_MODE: MuthurUplinkMode = "plan";

const READ_ONLY_TOOLS = new Set([
  "observe_operator_pane",
  "clock",
  "git_status",
  "git_diff",
  "justbash",
]);

const DEBUG_TOOLS = new Set([
  ...READ_ONLY_TOOLS,
  "open_operator_file",
  "suggest_operator_edit",
  "workspace_exec",
]);

const AGENT_TOOLS = new Set([
  ...DEBUG_TOOLS,
  "convert_document_to_markdown",
  "localfs",
  "export_markdown_to_docx",
  "export_markdown_to_pdf",
]);

const TOOLS_BY_MODE: Record<MuthurUplinkMode, Set<string>> = {
  ask: READ_ONLY_TOOLS,
  plan: READ_ONLY_TOOLS,
  debug: DEBUG_TOOLS,
  agent: AGENT_TOOLS,
};

export function normalizeMuthurUplinkMode(value: unknown): MuthurUplinkMode {
  if (value === "ask" || value === "plan" || value === "agent" || value === "debug") {
    return value;
  }
  return DEFAULT_MODE;
}

export function loadMuthurUplinkMode(): MuthurUplinkMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    return normalizeMuthurUplinkMode(window.localStorage.getItem(MUTHUR_UPLINK_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMuthurUplinkMode(mode: MuthurUplinkMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_UPLINK_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage write failures
  }
}

export function getMuthurUplinkModeMeta(mode: MuthurUplinkMode): MuthurUplinkModeMeta {
  return MUTHUR_UPLINK_MODES.find((entry) => entry.id === mode) ?? MUTHUR_UPLINK_MODES[1];
}

export function getMuthurUplinkCommitPolicy(mode: MuthurUplinkMode): MuthurUplinkCommitPolicy {
  return getMuthurUplinkModeMeta(mode).commit;
}

export function allowsOperatorPaneEdits(mode: MuthurUplinkMode): boolean {
  return mode === "agent" || mode === "debug";
}

export function shouldAutoCommitOperatorEdits(mode: MuthurUplinkMode): boolean {
  return mode === "agent";
}

export function isToolAllowedForUplinkMode(mode: MuthurUplinkMode, toolName: string): boolean {
  return TOOLS_BY_MODE[mode].has(toolName);
}

export function isLocalFsWriteAllowedForUplinkMode(mode: MuthurUplinkMode, action: string): boolean {
  const normalized = action.toLowerCase();
  if (!["write", "mkdir"].includes(normalized)) return true;
  return mode === "agent";
}

export function formatBlockedToolMessage(mode: MuthurUplinkMode, toolName: string): string {
  if (mode === "ask") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Ask mode is read-only — use questions to clarify intent. Switch to Plan to brainstorm, Debug to patch (no save), or Agent to edit and save."
    );
  }
  if (mode === "plan") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Plan mode is discuss-only — no edits or file creation. Switch to Debug to patch without saving, or Agent to edit and auto-save."
    );
  }
  if (mode === "debug") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      `Debug mode cannot run ${toolName}. Switch to Agent for disk writes, exports, or DOCX conversion.`
    );
  }
  return `[TOOL BLOCKED] ${toolName}\n\nNot available in ${mode.toUpperCase()} uplink mode.`;
}

export function buildUplinkModeSystemPrompt(mode: MuthurUplinkMode): string {
  switch (mode) {
    case "ask":
      return (
        "\n\nUPLINK MODE: ASK (OBSERVE). Your job is to understand before acting. " +
        "Ask focused clarifying questions until requirements are clear. " +
        "You may use read-only tools (observe_operator_pane, git_status, git_diff, clock, justbash search) to inform questions. " +
        "Do NOT edit files, create documents, or call suggest_operator_edit, open_operator_file, localfs, workspace_exec, convert, or export tools."
      );
    case "plan":
      return (
        "\n\nUPLINK MODE: PLAN (ASSIST). Brainstorm and discuss with the operator — outline approaches, tradeoffs, and steps. " +
        "You may use read-only tools to inspect context. " +
        "Do NOT edit, patch, convert, export, or create any files. Do NOT call suggest_operator_edit, open_operator_file, localfs, workspace_exec, convert, or export. " +
        "If the operator wants changes applied, tell them to switch to Debug (patch, manual save) or Agent (patch + auto-save)."
      );
    case "agent":
      return (
        "\n\nUPLINK MODE: AGENT (USE). Execute end-to-end: observe, edit via suggest_operator_edit, localfs write when needed. " +
        "Operator pane edits auto-save to disk when a writable path exists. Confirm what changed; Ctrl+Z still undoes in the pane."
      );
    case "debug":
      return (
        "\n\nUPLINK MODE: DEBUG (ASSIST). Investigate (observe_operator_pane, git_diff, workspace_exec) and patch via suggest_operator_edit. " +
        "Edits apply in the operator pane only — operator saves disk manually (Ctrl+S). Do NOT use localfs write, convert, or export unless operator switches to Agent. " +
        "Report evidence before and after fixes."
      );
    default:
      return "";
  }
}

export function shouldEnableToolsForUplinkMode(mode: MuthurUplinkMode, message: string): boolean {
  if (mode === "agent" || mode === "debug") return true;
  if (isCasualMuthurChat(message)) return false;
  return true;
}
