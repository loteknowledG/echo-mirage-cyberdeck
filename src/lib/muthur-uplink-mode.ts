/** MUTHUR composer uplink modes — autonomy, tools, and disk commit policy. */

import { getExecutableMuthurMission } from "@/lib/muthur/mission/muthur-mission-store";

export type MuthurUplinkMode = "ask" | "plan" | "agent" | "commander" | "debug";

export type MuthurUplinkCommitPolicy = "never" | "manual" | "immediate";

export const MUTHUR_UPLINK_MODE_STORAGE_KEY = "echo-mirage-muthur-uplink-mode-v1";

const DEFAULT_MODE: MuthurUplinkMode = "plan";

/** Visible in the composer mode roller (L-MUTHUR-001). */
export const MUTHUR_UPLINK_MODE_SELECTOR: MuthurUplinkMode[] = [
  "ask",
  "plan",
  "agent",
  "commander",
];

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
    title: "Conversation only — no tools",
    internalMode: "OBSERVE",
    commit: "never",
  },
  {
    id: "plan",
    label: "Plan",
    title: "Architecture, work orders, and ADRs — no tools",
    internalMode: "ASSIST",
    commit: "never",
  },
  {
    id: "agent",
    label: "Agent",
    title: "Single user-directed task execution with tools",
    internalMode: "USE",
    commit: "immediate",
  },
  {
    id: "commander",
    label: "Commander",
    title: "Mission orchestration — observe and prepare without a mission; execute when mission is ACTIVE",
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

export type MuthurUplinkToolContext = {
  /** True when mission lifecycle is ACTIVE — required for COMMANDER execution. */
  missionActive?: boolean;
};

function resolveMissionExecutionActive(context?: MuthurUplinkToolContext): boolean {
  if (typeof context?.missionActive === "boolean") {
    return context.missionActive;
  }
  return Boolean(getExecutableMuthurMission());
}

const READ_ONLY_TOOLS = new Set([
  "observe_operator_pane",
  "clock",
  "git_status",
  "git_diff",
  "justbash",
  "localfs",
  "operator_browser",
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
  "export_markdown_to_docx",
  "export_markdown_to_pdf",
]);

const TOOLS_BY_MODE: Record<MuthurUplinkMode, Set<string>> = {
  ask: new Set(),
  plan: new Set(),
  debug: DEBUG_TOOLS,
  agent: AGENT_TOOLS,
  commander: AGENT_TOOLS,
};

export function normalizeMuthurUplinkMode(value: unknown): MuthurUplinkMode {
  if (
    value === "ask" ||
    value === "plan" ||
    value === "agent" ||
    value === "commander" ||
    value === "debug"
  ) {
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
  return mode === "agent" || mode === "commander" || mode === "debug";
}

export function shouldAutoCommitOperatorEdits(mode: MuthurUplinkMode): boolean {
  return mode === "agent" || mode === "commander";
}

export function isToolAllowedForUplinkMode(
  mode: MuthurUplinkMode,
  toolName: string,
  context?: MuthurUplinkToolContext,
): boolean {
  if (mode === "commander" && !resolveMissionExecutionActive(context)) {
    return false;
  }
  return TOOLS_BY_MODE[mode].has(toolName);
}

export function isLocalFsWriteAllowedForUplinkMode(mode: MuthurUplinkMode, action: string): boolean {
  const normalized = action.toLowerCase();
  if (!["write", "mkdir"].includes(normalized)) return true;
  return mode === "agent" || mode === "commander";
}

export function formatBlockedToolMessage(mode: MuthurUplinkMode, toolName: string): string {
  if (mode === "commander" && !getExecutableMuthurMission()) {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Commander cannot execute mission work until the mission is ACTIVE. Observe, summarize, and prepare the mission in conversation first."
    );
  }
  if (mode === "ask") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Ask mode is conversation-only — no tools. Switch to Plan for architecture discussion, Agent for directed execution, or Commander for mission orchestration."
    );
  }
  if (mode === "plan") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Plan mode is discuss-only — no tools. Switch to Agent for directed execution or Commander for mission orchestration."
    );
  }
  if (mode === "debug") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      `Debug mode cannot run ${toolName}. Switch to Agent or Commander for disk writes, exports, or DOCX conversion.`
    );
  }
  return `[TOOL BLOCKED] ${toolName}\n\nNot available in ${mode.toUpperCase()} uplink mode.`;
}

export function buildUplinkModeSystemPrompt(mode: MuthurUplinkMode): string {
  switch (mode) {
    case "ask":
      return (
        "\n\nUPLINK MODE: ASK (OBSERVE). Conversation only — clarify intent with questions. " +
        "Do NOT call tools or mutate operator state."
      );
    case "plan":
      return (
        "\n\nUPLINK MODE: PLAN (ASSIST). Architecture, work orders, ADRs, and planning discussion only. " +
        "Do NOT call tools, edit files, or create documents. If execution is needed, tell the operator to switch to Agent or Commander."
      );
    case "agent":
      return (
        "\n\nUPLINK MODE: AGENT (USE). Execute a single user-directed task end-to-end: observe, edit via suggest_operator_edit, localfs write when needed. " +
        "Operator pane edits auto-save to disk when a writable path exists. Confirm what changed; Ctrl+Z still undoes in the pane."
      );
    case "commander":
      return (
        "\n\nUPLINK MODE: COMMANDER. Mission-aware orchestration. " +
        "Without an ACTIVE mission: observe the conversation, summarize intent, and help the operator form a mission — no tools. " +
        "With an ACTIVE mission: break work into steps, prepare delegation packages for external workers (Cursor, Codex, OpenCode, ChatGPT), " +
        "record assignments and results, and advance mission status. Use native worker tools — do not host CADRE runtimes. " +
        "Operator pane edits auto-save when a writable path exists."
      );
    case "debug":
      return (
        "\n\nUPLINK MODE: DEBUG (ASSIST). Investigate (observe_operator_pane, git_diff, workspace_exec) and patch via suggest_operator_edit. " +
        "Edits apply in the operator pane only — operator saves disk manually (Ctrl+S). Do NOT use localfs write, convert, or export unless operator switches to Agent or Commander. " +
        "Report evidence before and after fixes."
      );
    default:
      return "";
  }
}

export function shouldEnableToolsForUplinkMode(
  mode: MuthurUplinkMode,
  _message: string,
  context?: MuthurUplinkToolContext,
): boolean {
  switch (mode) {
    case "ask":
    case "plan":
      return false;
    case "commander":
      return resolveMissionExecutionActive(context);
    case "agent":
    case "debug":
      return true;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
