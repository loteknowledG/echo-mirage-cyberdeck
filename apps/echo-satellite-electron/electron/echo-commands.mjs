import { execFileSync } from "node:child_process";
import { clipboard } from "electron";
import { capturePrimaryMonitorPng } from "./capture.mjs";
import * as logger from "./logger.mjs";

/** @type {{ listening: boolean, recordingStartedAt: number | null, chunks: Buffer[] }} */
const audioState = {
  listening: false,
  recordingStartedAt: null,
  chunks: [],
};

/**
 * @param {string} action
 * @param {{ app?: import("electron").App }} [deps]
 */
export async function executeEchoSatelliteCommand(action, deps = {}) {
  switch (action) {
    case "echo.screenshot":
      return executeScreenshot();
    case "echo.start-listening":
      return startListening();
    case "echo.stop-listening":
      return stopListening();
    case "echo.save-recording":
      return saveRecording(deps.app);
    case "echo.copy-selected":
      return copySelected();
    default:
      return { ok: false, reason: `Unknown Echo command: ${action}` };
  }
}

async function executeScreenshot() {
  try {
    const capture = await capturePrimaryMonitorPng();
    return {
      ok: true,
      message: `Screenshot ${capture.width}×${capture.height} captured on Echo.`,
      pngBase64: capture.pngBase64,
      width: capture.width,
      height: capture.height,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Screenshot failed.",
    };
  }
}

function startListening() {
  if (audioState.listening) {
    return { ok: true, listening: true, message: "Already listening on Echo." };
  }
  audioState.listening = true;
  audioState.recordingStartedAt = Date.now();
  audioState.chunks = [];
  logger.log("echo-command: start-listening (mic scaffold armed)");
  return {
    ok: true,
    listening: true,
    message: "Echo listening armed — microphone pipeline scaffold active.",
  };
}

function stopListening() {
  if (!audioState.listening) {
    return { ok: true, listening: false, message: "Echo was not listening." };
  }
  audioState.listening = false;
  logger.log("echo-command: stop-listening");
  return {
    ok: true,
    listening: false,
    message: "Echo listening stopped.",
  };
}

/** @param {import("electron").App | undefined} app */
function saveRecording(app) {
  if (!audioState.recordingStartedAt && audioState.chunks.length === 0) {
    return { ok: false, reason: "No Echo recording buffered — start listening first." };
  }
  const durationMs = audioState.recordingStartedAt
    ? Date.now() - audioState.recordingStartedAt
    : 0;
  audioState.listening = false;
  audioState.recordingStartedAt = null;
  audioState.chunks = [];
  logger.log(`echo-command: save-recording scaffold (${durationMs}ms)`);
  return {
    ok: true,
    message: `Recording receipt saved (${Math.round(durationMs / 1000)}s scaffold — full mic ingest coming).`,
    durationMs,
    userData: app?.getPath?.("userData") ?? null,
  };
}

async function copySelected() {
  try {
    if (process.platform === "darwin") {
      execFileSync("osascript", [
        "-e",
        'tell application "System Events" to keystroke "c" using command down',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    const text = clipboard.readText()?.trim() ?? "";
    const image = clipboard.readImage();
    const hasImage = image && !image.isEmpty();
    const formats = clipboard.availableFormats();

    if (!text && !hasImage) {
      return {
        ok: false,
        reason:
          process.platform === "darwin"
            ? "Nothing on Echo clipboard — select content on the Echo Mac, then retry."
            : "Copy Selected is fully supported on Echo Mac (macOS) today.",
      };
    }

    let pngBase64;
    if (hasImage) {
      pngBase64 = image.toPNG().toString("base64");
    }

    return {
      ok: true,
      message: hasImage
        ? `Copied selection from Echo (${text ? "text + image" : "image"}).`
        : `Copied ${text.length} characters from Echo selection.`,
      clipboard: {
        text: text || undefined,
        hasImage,
        formats,
      },
      pngBase64,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Copy selected failed.",
    };
  }
}

export function readEchoListeningState() {
  return {
    listening: audioState.listening,
    recordingStartedAt: audioState.recordingStartedAt,
  };
}
