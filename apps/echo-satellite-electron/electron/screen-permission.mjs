import { desktopCapturer, systemPreferences } from "electron";
import { probeMacFullDesktopCapture } from "./capture-screencapture.mjs";
import {
  cgPreflightScreenCaptureAccess,
  cgRequestScreenCaptureAccess,
  SCREEN_RECORDING_HINT,
  STALE_SCREEN_RECORDING_HINT,
} from "./screen-permission-mac.mjs";

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
      fetchWindowIcons: false,
    });
  } catch {
    /* optional warm-up */
  }
}

/**
 * @returns {Promise<{
 *   screenRecording: boolean,
 *   electronStatus: string,
 *   preflight: boolean,
 *   stale: boolean,
 *   hint: string | null
 * }>}
 */
export async function checkScreenRecordingAccess(options = {}) {
  const { probe = true } = options;

  if (process.platform !== "darwin") {
    return {
      screenRecording: true,
      electronStatus: "unsupported",
      preflight: true,
      stale: false,
      hint: null,
    };
  }

  const electronStatus = getElectronScreenAccessStatus();
  const preflight = await cgPreflightScreenCaptureAccess();

  if (!probe) {
    const looksGranted = electronStatus === "granted" || preflight;
    return {
      screenRecording: looksGranted,
      electronStatus,
      preflight,
      stale: false,
      hint: looksGranted ? null : macScreenRecordingHint(electronStatus),
    };
  }

  await warmElectronScreenCapture();
  const fullProbe = await probeMacFullDesktopCapture();
  if (fullProbe.ok) {
    return {
      screenRecording: true,
      electronStatus,
      preflight,
      stale: false,
      hint: null,
    };
  }

  const looksGranted = electronStatus === "granted" || preflight;
  if (looksGranted) {
    return {
      screenRecording: false,
      electronStatus,
      preflight,
      stale: true,
      hint: STALE_SCREEN_RECORDING_HINT,
    };
  }

  return {
    screenRecording: false,
    electronStatus,
    preflight,
    stale: false,
    hint: fullProbe.error ?? macScreenRecordingHint(electronStatus),
  };
}

/** Prompt macOS screen-recording dialog and re-probe. */
export async function requestScreenRecordingAccess() {
  if (process.platform !== "darwin") {
    return checkScreenRecordingAccess({ probe: true });
  }
  await cgRequestScreenCaptureAccess();
  await warmElectronScreenCapture();
  return checkScreenRecordingAccess({ probe: true });
}

/** @param {string} electronStatus */
function macScreenRecordingHint(electronStatus) {
  if (electronStatus === "denied" || electronStatus === "restricted") {
    return (
      "Screen Recording blocked. System Settings → Privacy & Security → " +
      "Screen & System Audio Recording → Echo-Satellite ON, then quit (Cmd+Q) and reopen."
    );
  }
  return SCREEN_RECORDING_HINT;
}
