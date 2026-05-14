import type { ComputerUseAction, ComputerUseResult, ComputerUseStatus } from "./computer-use-types";
import { createSafetyGuard } from "./safety-guard";
import * as windowManager from "./window-manager";
import * as screenCapture from "./screen-capture";
import * as inputController from "./input-controller";
import * as uiVerification from "./ui-verification";

const safetyGuard = createSafetyGuard();

async function executeAction(action: ComputerUseAction): Promise<ComputerUseResult> {
  switch (action.name) {
    case "get_active_window":
      return windowManager.getActiveWindow();

    case "list_open_windows":
      return windowManager.listOpenWindows();

    case "capture_screen":
      return screenCapture.captureScreen();

    case "focus_window": {
      const titleOrAppName = action.params?.titleOrAppName as string | undefined;
      if (!titleOrAppName) {
        const start = Date.now();
        return {
          success: false,
          action: "focus_window",
          status: "error",
          error: "MISSING_PARAM: titleOrAppName required",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return windowManager.focusWindow(titleOrAppName);
    }

    case "paste_text": {
      const text = action.params?.text as string | undefined;
      if (!text) {
        const start = Date.now();
        return {
          success: false,
          action: "paste_text",
          status: "error",
          error: "MISSING_PARAM: text required",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return inputController.pasteText(text);
    }

    case "hotkey": {
      const keys = action.params?.keys as string | undefined;
      if (!keys) {
        const start = Date.now();
        return {
          success: false,
          action: "hotkey",
          status: "error",
          error: "MISSING_PARAM: keys required",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return inputController.sendHotkey(keys);
    }

    case "verify_text_visible": {
      const text = action.params?.text as string | undefined;
      if (!text) {
        const start = Date.now();
        return {
          success: false,
          action: "verify_text_visible",
          status: "error",
          error: "MISSING_PARAM: text required",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return uiVerification.verifyTextVisible(text);
    }

    case "verify_window_active": {
      const titleOrAppName = action.params?.titleOrAppName as string | undefined;
      if (!titleOrAppName) {
        const start = Date.now();
        return {
          success: false,
          action: "verify_window_active",
          status: "error",
          error: "MISSING_PARAM: titleOrAppName required",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return uiVerification.verifyWindowActive(titleOrAppName);
    }

    case "stop_execution":
      return {
        success: true,
        action: "stop_execution",
        status: "stopped",
        data: { stopped: true },
        timestamp: new Date().toISOString(),
        durationMs: 0,
      };

    default: {
      const start = Date.now();
      return {
        success: false,
        action: action.name,
        status: "error" as ComputerUseStatus,
        error: `UNKNOWN_ACTION: ${action.name} is not a recognized computer use action`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }
  }
}

export async function runComputerUseAction(
  action: ComputerUseAction
): Promise<ComputerUseResult> {
  const start = Date.now();

  if (!action || typeof action !== "object" || !("name" in action)) {
    return {
      success: false,
      action: "unknown",
      status: "error",
      error: "INVALID_ACTION: action must be an object with a name property",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  const validation = safetyGuard.validateAction(action);
  if (!validation.valid) {
    return {
      success: false,
      action: action.name,
      status: "error",
      error: validation.error,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  const result = await executeAction(action);

  if (action.verify && result.success) {
    let verificationResult;
    if (action.verify.type === "text_visible") {
      verificationResult = await uiVerification.verifyTextVisible(action.verify.target);
    } else if (action.verify.type === "window_active") {
      verificationResult = await uiVerification.verifyWindowActive(action.verify.target);
    }

    if (verificationResult) {
      result.verification = verificationResult.data as { success: boolean; matches: boolean; reason?: string } | undefined;
    }
  }

  return result;
}

export function getSafetyConfig() {
  return safetyGuard.getConfig();
}