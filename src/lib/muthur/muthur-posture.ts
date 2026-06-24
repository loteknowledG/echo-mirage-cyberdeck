/** MUTHUR operational postures — autonomy, tools, and disk commit policy. */

import { getExecutableMuthurMission } from "@/lib/muthur/mission/muthur-mission-store";

export type MuthurPosture = "plan" | "agent" | "commander";

export type MuthurPostureCommitPolicy = "never" | "manual" | "immediate";

/** Legacy key — kept so existing operator preference survives the rename. */
export const MUTHUR_POSTURE_STORAGE_KEY = "echo-mirage-muthur-uplink-mode-v1";

const DEFAULT_POSTURE: MuthurPosture = "plan";

/** Visible in the composer posture roller. */
export const MUTHUR_POSTURE_SELECTOR: MuthurPosture[] = ["plan", "agent", "commander"];

export type MuthurPostureMeta = {
  id: MuthurPosture;
  label: string;
  title: string;
  internalMode: "OBSERVE" | "ASSIST" | "USE";
  commit: MuthurPostureCommitPolicy;
};

export const MUTHUR_POSTURES: MuthurPostureMeta[] = [
  {
    id: "plan",
    label: "Plan",
    title: "Observe panes, discuss architecture — read-only, no edits",
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
];

export type MuthurPostureToolContext = {
  /** True when mission lifecycle is ACTIVE — required for COMMANDER execution. */
  missionActive?: boolean;
};

function resolveMissionExecutionActive(context?: MuthurPostureToolContext): boolean {
  if (typeof context?.missionActive === "boolean") {
    return context.missionActive;
  }
  return Boolean(getExecutableMuthurMission());
}

const PLAN_TOOLS = new Set([
  "observe_operator_pane",
  "operator_browser",
  "clock",
  "git_status",
  "git_diff",
]);

const EXECUTION_TOOLS = new Set([
  "observe_operator_pane",
  "clock",
  "git_status",
  "git_diff",
  "justbash",
  "localfs",
  "operator_browser",
  "open_operator_file",
  "suggest_operator_edit",
  "workspace_exec",
  "convert_document_to_markdown",
  "export_markdown_to_docx",
  "export_markdown_to_pdf",
  "request_pi_control_lease",
  "delegate_pi_computer_use",
  "pi_computer_use",
]);

const TOOLS_BY_POSTURE: Record<MuthurPosture, Set<string>> = {
  plan: PLAN_TOOLS,
  agent: EXECUTION_TOOLS,
  commander: EXECUTION_TOOLS,
};

export function normalizeMuthurPosture(value: unknown): MuthurPosture {
  if (value === "plan" || value === "agent" || value === "commander") {
    return value;
  }
  // Legacy stored values (ask/debug uplink modes)
  if (value === "ask") return "plan";
  if (value === "debug") return "agent";
  return DEFAULT_POSTURE;
}

export function loadMuthurPosture(): MuthurPosture {
  if (typeof window === "undefined") return DEFAULT_POSTURE;
  try {
    return normalizeMuthurPosture(window.localStorage.getItem(MUTHUR_POSTURE_STORAGE_KEY));
  } catch {
    return DEFAULT_POSTURE;
  }
}

export function saveMuthurPosture(posture: MuthurPosture): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_POSTURE_STORAGE_KEY, posture);
  } catch {
    // ignore storage write failures
  }
}

export function getMuthurPostureMeta(posture: MuthurPosture): MuthurPostureMeta {
  return MUTHUR_POSTURES.find((entry) => entry.id === posture) ?? MUTHUR_POSTURES[0];
}

export function getMuthurPostureCommitPolicy(posture: MuthurPosture): MuthurPostureCommitPolicy {
  return getMuthurPostureMeta(posture).commit;
}

export function allowsOperatorPaneEdits(posture: MuthurPosture): boolean {
  return posture === "agent" || posture === "commander";
}

export function shouldAutoCommitOperatorEdits(posture: MuthurPosture): boolean {
  return posture === "agent" || posture === "commander";
}

export function isToolAllowedForPosture(
  posture: MuthurPosture,
  toolName: string,
  context?: MuthurPostureToolContext,
): boolean {
  if (posture === "commander" && !resolveMissionExecutionActive(context)) {
    return false;
  }
  return TOOLS_BY_POSTURE[posture].has(toolName);
}

export function isLocalFsWriteAllowedForPosture(posture: MuthurPosture, action: string): boolean {
  const normalized = action.toLowerCase();
  if (!["write", "mkdir"].includes(normalized)) return true;
  return posture === "agent" || posture === "commander";
}

export function formatBlockedToolMessage(posture: MuthurPosture, toolName: string): string {
  if (posture === "commander" && !getExecutableMuthurMission()) {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Commander cannot execute mission work until the mission is ACTIVE. Observe, summarize, and prepare the mission in conversation first."
    );
  }
  if (posture === "plan") {
    return (
      `[TOOL BLOCKED] ${toolName}\n\n` +
      "Plan posture is read-only — observe panes and discuss, but no edits. Switch to Agent for directed execution or Commander for mission orchestration."
    );
  }
  return `[TOOL BLOCKED] ${toolName}\n\nNot available in ${posture.toUpperCase()} posture.`;
}

export function buildMuthurPostureSystemPrompt(posture: MuthurPosture): string {
  switch (posture) {
    case "plan":
      return (
        "\n\nMUTHUR POSTURE: PLAN (ASSIST). Observe operator panes (observe_operator_pane, operator_browser), discuss architecture, work orders, and ADRs. " +
        "Read-only — do NOT edit files, write to disk, or mutate operator state. If execution is needed, tell the operator to switch to Agent or Commander."
      );
    case "agent":
      return (
        "\n\nMUTHUR POSTURE: AGENT (USE). Execute a single user-directed task end-to-end: observe, edit via suggest_operator_edit, localfs write when needed. " +
        "Operator pane edits auto-save to disk when a writable path exists. Confirm what changed; Ctrl+Z still undoes in the pane."
      );
    case "commander":
      return (
        "\n\nMUTHUR POSTURE: COMMANDER. Mission-aware orchestration. " +
        "Without an ACTIVE mission: observe the conversation, summarize intent, and help the operator form a mission — no tools. " +
        "With an ACTIVE mission: break work into steps, prepare delegation packages for external workers (Cursor, Codex, OpenCode, ChatGPT), " +
        "record assignments and results, and advance mission status. Use native worker tools — do not host CADRE runtimes. " +
        "Operator pane edits auto-save when a writable path exists."
      );
    default: {
      const _exhaustive: never = posture;
      return _exhaustive;
    }
  }
}

export function shouldEnableToolsForPosture(
  posture: MuthurPosture,
  _message: string,
  context?: MuthurPostureToolContext,
): boolean {
  switch (posture) {
    case "plan":
      return true;
    case "commander":
      return resolveMissionExecutionActive(context);
    case "agent":
      return true;
    default: {
      const _exhaustive: never = posture;
      return _exhaustive;
    }
  }
}
