import type { ScreenCaptureResult, ComputerUseResult } from "./computer-use-types";

export async function captureScreen(): Promise<ComputerUseResult> {
  const start = Date.now();
  const result: ScreenCaptureResult = {
    success: false,
    data: undefined,
    timestamp: new Date().toISOString(),
  };

  return {
    success: false,
    action: "capture_screen",
    status: "error",
    data: result,
    error: "SCREEN_CAPTURE_NOT_IMPLEMENTED: Screenshot capture is not available in this browser environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export function isScreenCaptureSupported(): boolean {
  return false;
}