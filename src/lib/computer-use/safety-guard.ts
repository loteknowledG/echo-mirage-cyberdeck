import type { ComputerUseAction, SafetyConfig } from "./computer-use-types";

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxPasteLength: 50000,
  maxActionsPerMinute: 60,
  requireConfirmation: true,
};

const recentActions: { timestamp: number; count: number }[] = [];
const MAX_HISTORY = 100;

export function createSafetyGuard(config: SafetyConfig = DEFAULT_SAFETY_CONFIG) {
  function cleanOldActions() {
    const now = Date.now();
    const cutoff = now - 60000;
    while (recentActions.length > 0 && recentActions[0].timestamp < cutoff) {
      recentActions.shift();
    }
  }

  function recordAction() {
    cleanOldActions();
    const now = Date.now();
    if (recentActions.length > 0 && recentActions[recentActions.length - 1].timestamp === now) {
      recentActions[recentActions.length - 1].count++;
    } else {
      recentActions.push({ timestamp: now, count: 1 });
    }
    while (recentActions.length > MAX_HISTORY) {
      recentActions.shift();
    }
  }

  function getRecentActionCount(): number {
    cleanOldActions();
    return recentActions.reduce((sum, entry) => sum + entry.count, 0);
  }

  return {
    validateAction(action: ComputerUseAction): { valid: boolean; error?: string } {
      if (!action || typeof action !== "object" || !("name" in action)) {
        return { valid: false, error: "SAFETY_REJECT: Empty or invalid action" };
      }

      if (action.name === "paste_text") {
        const text = action.params?.text as string | undefined;
        if (!text || text.trim().length === 0) {
          return { valid: false, error: "SAFETY_REJECT: Empty paste payload" };
        }
        if (text.length > config.maxPasteLength) {
          return {
            valid: false,
            error: `SAFETY_REJECT: Paste payload ${text.length} exceeds max ${config.maxPasteLength}`,
          };
        }
      }

      const recentCount = getRecentActionCount();
      if (recentCount >= config.maxActionsPerMinute) {
        return {
          valid: false,
          error: `SAFETY_REJECT: Rate limit exceeded (${recentCount}/${config.maxActionsPerMinute} actions per minute)`,
        };
      }

      if (config.requireConfirmation && action.name !== "stop_execution" && action.name !== "get_active_window" && action.name !== "list_open_windows" && action.name !== "capture_screen") {
        if (!action.confirm) {
          return {
            valid: false,
            error: "SAFETY_REJECT: Action requires explicit confirmation flag",
          };
        }
      }

      recordAction();
      return { valid: true };
    },

    getConfig() {
      return { ...config };
    },
  };
}

export function isActionSafeForAutomation(action: ComputerUseAction): boolean {
  const safeActions = [
    "get_active_window",
    "list_open_windows",
    "capture_screen",
    "verify_text_visible",
    "verify_window_active",
    "stop_execution",
  ];
  return safeActions.includes(action.name);
}