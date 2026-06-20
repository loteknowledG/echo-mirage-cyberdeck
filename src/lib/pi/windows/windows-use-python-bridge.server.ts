import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PiComputerUseReceipt } from "../pi-computer-use-types";

const PROJECT_ROOT = process.cwd();

export const PI_VENV_PYTHON =
  process.platform === "win32"
    ? path.join(PROJECT_ROOT, ".venv-pi", "Scripts", "python.exe")
    : path.join(PROJECT_ROOT, ".venv-pi", "bin", "python");

export const WINDOWS_USE_BRIDGE_SCRIPT = path.join(
  PROJECT_ROOT,
  "scripts",
  "pi",
  "windows-use-bridge.py",
);

export const PI_WINDOWS_USE_REMEDIATION =
  "python -m venv .venv-pi && .venv-pi\\Scripts\\pip install -r requirements-pi.txt";

export function isPiVenvInstalled(): boolean {
  return fs.existsSync(PI_VENV_PYTHON);
}

export function isWindowsUseBridgeAvailable(): boolean {
  return isPiVenvInstalled() && fs.existsSync(WINDOWS_USE_BRIDGE_SCRIPT);
}

export type WindowsUseBridgePayload = {
  capability:
    | "check"
    | "screenshot"
    | "mouse_move"
    | "mouse_click"
    | "double_click"
    | "type_text"
    | "hotkey"
    | "scroll"
    | "active_window";
  params?: Record<string, unknown>;
};

export type WindowsUseBridgeResult = {
  ok: boolean;
  receipt: PiComputerUseReceipt;
  exitCode: number;
  spawnError?: string;
};

function parseBridgeStdout(stdout: string): PiComputerUseReceipt | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as PiComputerUseReceipt;
  } catch {
    return null;
  }
}

function blockedReceipt(
  capability: WindowsUseBridgePayload["capability"],
  summary: string,
  error: string,
): PiComputerUseReceipt {
  return {
    id: `pi-rcpt-blocked-${Date.now()}`,
    actor: "pi",
    backend: "windows-use",
    capability: capability === "check" ? "screenshot" : capability,
    status: "blocked",
    createdAt: new Date().toISOString(),
    durationMs: 0,
    summary,
    error,
  };
}

export function invokeWindowsUseBridge(
  payload: WindowsUseBridgePayload,
): WindowsUseBridgeResult {
  if (process.platform !== "win32") {
    return {
      ok: false,
      exitCode: 2,
      receipt: blockedReceipt(
        payload.capability,
        "windows-use requires Windows",
        `Platform ${process.platform} is not supported`,
      ),
    };
  }

  if (!isWindowsUseBridgeAvailable()) {
    return {
      ok: false,
      exitCode: 1,
      receipt: blockedReceipt(
        payload.capability,
        "windows-use backend not installed",
        PI_WINDOWS_USE_REMEDIATION,
      ),
    };
  }

  const result = spawnSync(
    PI_VENV_PYTHON,
    [WINDOWS_USE_BRIDGE_SCRIPT, JSON.stringify(payload)],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120_000,
    },
  );

  if (result.error) {
    return {
      ok: false,
      exitCode: 1,
      spawnError: result.error.message,
      receipt: blockedReceipt(
        payload.capability,
        "windows-use bridge spawn failed",
        result.error.message,
      ),
    };
  }

  const receipt = parseBridgeStdout(result.stdout ?? "");
  if (!receipt) {
    const stderr = (result.stderr ?? "").trim();
    return {
      ok: false,
      exitCode: result.status ?? 1,
      receipt: blockedReceipt(
        payload.capability,
        "windows-use bridge returned invalid JSON",
        stderr || "Empty bridge output",
      ),
    };
  }

  return {
    ok: receipt.status === "success",
    exitCode: result.status ?? (receipt.status === "success" ? 0 : 1),
    receipt,
  };
}

export function checkWindowsUseBackend(): WindowsUseBridgeResult {
  return invokeWindowsUseBridge({ capability: "check" });
}
