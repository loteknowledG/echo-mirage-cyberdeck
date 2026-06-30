import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** @returns {Promise<boolean>} */
export async function cgPreflightScreenCaptureAccess() {
  if (process.platform !== "darwin") return true;
  try {
    const { stdout } = await execFileAsync("/usr/bin/swift", [
      "-e",
      `import CoreGraphics
print(CGPreflightScreenCaptureAccess())`,
    ]);
    const text = stdout.trim();
    return text === "true" || text === "1";
  } catch {
    return false;
  }
}

/** Shows the macOS screen-recording permission dialog when needed. @returns {Promise<boolean>} */
export async function cgRequestScreenCaptureAccess() {
  if (process.platform !== "darwin") return true;
  try {
    const { stdout } = await execFileAsync("/usr/bin/swift", [
      "-e",
      `import CoreGraphics
print(CGRequestScreenCaptureAccess())`,
    ]);
    const text = stdout.trim();
    return text === "true" || text === "1";
  } catch {
    return false;
  }
}

export const STALE_SCREEN_RECORDING_HINT =
  "macOS permission is stale (toggle shows ON but capture is blocked). " +
  "System Settings → Privacy & Security → Screen & System Audio Recording → " +
  "toggle Echo-Satellite OFF, then ON → quit Echo Satellite with Cmd+Q → reopen. " +
  "If still broken: click − to remove Echo-Satellite from the list, reopen the app, and Allow when prompted.";

export const SCREEN_RECORDING_HINT =
  "Enable Echo-Satellite in Screen & System Audio Recording, then quit (Cmd+Q) and reopen — closing the window is not enough.";
