import type { ComputerUseResult } from "./computer-use-types";

export async function pasteText(text: string): Promise<ComputerUseResult> {
  const start = Date.now();

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      action: "paste_text",
      status: "error",
      data: null,
      error: "PASTE_TEXT_REJECTED: Empty text payload",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  if (text.length > 50000) {
    return {
      success: false,
      action: "paste_text",
      status: "error",
      data: null,
      error: `PASTE_TEXT_REJECTED: Payload exceeds maximum length of 50000 (received ${text.length})`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  return {
    success: false,
    action: "paste_text",
    status: "error",
    data: null,
    error: "PASTE_TEXT_NOT_IMPLEMENTED: Clipboard paste is not available in this environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export async function sendHotkey(_keys: string): Promise<ComputerUseResult> {
  const start = Date.now();

  if (!_keys || _keys.trim().length === 0) {
    return {
      success: false,
      action: "hotkey",
      status: "error",
      data: null,
      error: "HOTKEY_REJECTED: Empty key sequence",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  return {
    success: false,
    action: "hotkey",
    status: "error",
    data: null,
    error: "HOTKEY_NOT_IMPLEMENTED: Hotkey simulation is not available in this environment",
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}