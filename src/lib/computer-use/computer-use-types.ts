export type ActionName =
  | "get_active_window"
  | "list_open_windows"
  | "capture_screen"
  | "focus_window"
  | "paste_text"
  | "hotkey"
  | "verify_text_visible"
  | "verify_window_active"
  | "stop_execution"
  | "unknown";

export interface ComputerUseAction {
  name: ActionName;
  params?: Record<string, string | number | boolean>;
  verify?: {
    type: "text_visible" | "window_active";
    target: string;
  };
  confirm?: boolean;
}

export type ComputerUseStatus = "idle" | "running" | "completed" | "error" | "stopped";

export interface WindowInfo {
  title: string;
  appName?: string;
  pid?: number;
  isFocused: boolean;
}

export interface ScreenCaptureResult {
  success: boolean;
  data?: string;
  format?: "base64" | "blob";
  width?: number;
  height?: number;
  timestamp: string;
}

export interface VerificationResult {
  success: boolean;
  matches: boolean;
  reason?: string;
}

export interface ComputerUseResult {
  success: boolean;
  action: ActionName;
  status: ComputerUseStatus;
  data?: unknown;
  verification?: VerificationResult;
  error?: string;
  timestamp: string;
  durationMs: number;
}

export interface SafetyConfig {
  maxPasteLength: number;
  maxActionsPerMinute: number;
  requireConfirmation: boolean;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxPasteLength: 50000,
  maxActionsPerMinute: 60,
  requireConfirmation: true,
};