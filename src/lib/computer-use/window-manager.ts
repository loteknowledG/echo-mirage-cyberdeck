import type { WindowInfo, ComputerUseResult } from "./computer-use-types";

export async function getActiveWindow(): Promise<ComputerUseResult> {
  const start = Date.now();
  return {
    success: false,
    action: "get_active_window",
    status: "error",
    data: null,
    error: "WINDOW_MANAGER_NOT_IMPLEMENTED: Active window detection is not available in this environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export async function listOpenWindows(): Promise<ComputerUseResult> {
  const start = Date.now();
  return {
    success: false,
    action: "list_open_windows",
    status: "error",
    data: null,
    error: "WINDOW_MANAGER_NOT_IMPLEMENTED: Window enumeration is not available in this environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export async function focusWindow(_titleOrAppName: string): Promise<ComputerUseResult> {
  const start = Date.now();
  return {
    success: false,
    action: "focus_window",
    status: "error",
    data: null,
    error: "WINDOW_MANAGER_NOT_IMPLEMENTED: Window focus is not available in this environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}