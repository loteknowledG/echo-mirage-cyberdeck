import { desktopCapturer, systemPreferences } from "electron";
import { capturePrimaryMonitorPngBase64, withCaptureTimeout } from "./capture.mjs";

const PROBE_TIMEOUT_MS = 8_000;

/** @returns {"not-determined"|"granted"|"denied"|"restricted"|"unknown"|"unsupported"} */
export function getElectronScreenAccessStatus() {
  if (process.platform !== "darwin") return "unsupported";
  try {
    return systemPreferences.getMediaAccessStatus("screen");
  } catch {
    return "unknown";
  }
}

/** Trigger Chromium screen-capture registration (helps macOS TCC on some versions). */
export async function warmElectronScreenCapture() {
  if (process.platform !== "darwin") return;
  try {
    await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });
  } catch {
    /* optional warm-up */
  }
}

/** True when node-screenshots can grab a non-empty frame (authoritative on Mac). */
export async function probeNativeScreenCapture() {
  const pngBase64 = await withCaptureTimeout(
    capturePrimaryMonitorPngBase64(),
    PROBE_TIMEOUT_MS,
    "Screen capture timed out. Toggle Echo-Satellite OFF then ON in Screen Recording, quit the app (Cmd+Q), and reopen.",
  );
  return pngBase64.length > 0;
}

/**
 * @returns {Promise<{ screenRecording: boolean, electronStatus: string, hint: string | null }>}
 */
export async function checkScreenRecordingAccess(options = {}) {
  const { probe = true } = options;

  if (process.platform !== "darwin") {
    return { screenRecording: true, electronStatus: "unsupported", hint: null };
  }

  const electronStatus = getElectronScreenAccessStatus();
  if (electronStatus === "granted") {
    return { screenRecording: true, electronStatus, hint: null };
  }

  if (!probe) {
    return {
      screenRecording: false,
      electronStatus,
      hint: macScreenRecordingHint(electronStatus),
    };
  }

  try {
    await warmElectronScreenCapture();
    const works = await probeNativeScreenCapture();
    if (works) {
      return { screenRecording: true, electronStatus, hint: null };
    }
  } catch (error) {
    return {
      screenRecording: false,
      electronStatus,
      hint: error instanceof Error ? error.message : macScreenRecordingHint(electronStatus),
    };
  }

  return {
    screenRecording: false,
    electronStatus,
    hint: macScreenRecordingHint(electronStatus),
  };
}

/** @param {string} electronStatus */
function macScreenRecordingHint(electronStatus) {
  if (electronStatus === "denied" || electronStatus === "restricted") {
    return "Screen Recording blocked. System Settings → Privacy & Security → Screen Recording → Echo-Satellite ON, then quit (Cmd+Q) and reopen.";
  }
  return "Enable Echo-Satellite in Screen Recording, then quit (Cmd+Q) and reopen — closing the window is not enough.";
}
