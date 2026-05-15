import type { ScreenCaptureResult, ComputerUseResult } from "./computer-use-types";

let lastCapturedImage: string | null = null;

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
    error: "SCREEN_CAPTURE_NOT_IMPLEMENTED: Screenshot capture is not available in this browser environment. Use manual screenshot upload instead.",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export function isScreenCaptureSupported(): boolean {
  return false;
}

export function injectManualScreenshot(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== "string") return false;
  if (!dataUrl.startsWith("data:image/")) return false;
  lastCapturedImage = dataUrl;
  return true;
}

export function getLastCapturedImage(): string | null {
  return lastCapturedImage;
}

export function hasManualScreenshot(): boolean {
  return lastCapturedImage !== null;
}

export function clearManualScreenshot(): void {
  lastCapturedImage = null;
}