import type { VerificationResult, ComputerUseResult } from "./computer-use-types";

export async function verifyTextVisible(_text: string): Promise<ComputerUseResult> {
  const start = Date.now();
  const result: VerificationResult = {
    success: false,
    matches: false,
    reason: "OCR_NOT_IMPLEMENTED: Text verification requires screenshot capture and OCR, which is not available in this environment",
  };

  return {
    success: false,
    action: "verify_text_visible",
    status: "error",
    data: result,
    error: result.reason,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export async function verifyWindowActive(_titleOrAppName: string): Promise<ComputerUseResult> {
  const start = Date.now();
  const result: VerificationResult = {
    success: false,
    matches: false,
    reason: "WINDOW_VERIFY_NOT_IMPLEMENTED: Active window verification requires platform-specific APIs not available in browser",
  };

  return {
    success: false,
    action: "verify_window_active",
    status: "error",
    data: result,
    error: result.reason,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}