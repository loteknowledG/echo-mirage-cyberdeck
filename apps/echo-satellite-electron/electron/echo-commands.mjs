import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clipboard } from "electron";
import { capturePrimaryMonitorJpeg } from "./capture.mjs";
import {
  enqueueEchoExtensionCommand,
  getEchoExtensionBridgeStatus,
} from "./echo-extension-bridge.mjs";
import * as logger from "./logger.mjs";

/** @type {{ listening: boolean, recordingStartedAt: number | null, chunks: Buffer[] }} */
const audioState = {
  listening: false,
  recordingStartedAt: null,
  chunks: [],
};

/**
 * @param {string} action
 * @param {{ app?: import("electron").App, tabId?: number, payload?: { prompt?: string, pngBase64?: string, pngBase64List?: string[] } }} [deps]
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
    case "echo.read-clipboard":
      return readClipboard();
    case "echo.ext-list-tabs":
      return listExtensionTabs();
    case "echo.ext-capture-text":
      return captureExtensionTab(deps.tabId);
    case "echo.ext-capture-active":
      return captureExtensionActiveTab();
    case "echo.ext-bridge-status":
      return { ok: true, ...getEchoExtensionBridgeStatus(), message: "echo-extension bridge status." };
    case "echo.solve-codex":
      return solveViaCodex(deps.payload);
    default:
      return { ok: false, reason: `Unknown Echo command: ${action}` };
  }
}

function runCodexExec(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === "win32" ? "cmd.exe" : "codex";
    const cmdArgs =
      process.platform === "win32" ? ["/c", "codex", ...args] : args;
    const child = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Codex timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    child.stderr.on("data", (buf) => {
      stderr += buf.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr: stderr.trim() });
    });
  });
}

/** @param {{ prompt?: string, pngBase64?: string, pngBase64List?: string[] } | undefined} payload */
async function solveViaCodex(payload) {
  const prompt = payload?.prompt?.trim() || "";
  if (!prompt) {
    return { ok: false, reason: "echo.solve-codex requires prompt." };
  }
  const images = [
    ...(Array.isArray(payload?.pngBase64List) ? payload.pngBase64List : []),
  ];
  if (images.length === 0 && payload?.pngBase64?.trim()) {
    images.push(payload.pngBase64.trim());
  }

  const tmp = await mkdtemp(join(tmpdir(), "echo-codex-"));
  const outputPath = join(tmp, "answer.txt");
  try {
    const args = ["exec", "--skip-git-repo-check", "--ephemeral", "-o", outputPath];
    for (let i = 0; i < images.length; i += 1) {
      const imagePath = join(tmp, `capture-${i + 1}.png`);
      await writeFile(imagePath, Buffer.from(images[i], "base64"));
      args.push("-i", imagePath);
    }
    const model = process.env.SURVEY_CODEX_MODEL?.trim();
    if (model) args.push("-m", model);
    args.push(prompt);
    const { code, stderr } = await runCodexExec(args, Number(process.env.SURVEY_CODEX_TIMEOUT_MS) || 180_000);
    const answerText = (await readFile(outputPath, "utf8").catch(() => "")).trim();
    if (!answerText) {
      return {
        ok: false,
        reason: stderr || `Codex exec failed (exit ${code}). Run codex login on Echo Satellite machine.`,
      };
    }
    return {
      ok: true,
      message: "Solved via Echo Codex CLI.",
      answerText,
      provider: "codex-relay",
      model: model || "codex-subscription",
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Codex solve failed." };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

async function listExtensionTabs() {
  try {
    const result = await enqueueEchoExtensionCommand("list-tabs");
    if (!result?.ok) {
      return {
        ok: false,
        reason: result?.reason ?? "echo-extension list-tabs failed.",
      };
    }
    return {
      ok: true,
      message: `Listed ${Array.isArray(result.tabs) ? result.tabs.length : 0} Chrome tab(s) via echo-extension.`,
      tabs: result.tabs ?? [],
      bridge: getEchoExtensionBridgeStatus(),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "echo-extension list-tabs failed.",
      bridge: getEchoExtensionBridgeStatus(),
    };
  }
}

/** @param {number | undefined} tabId */
async function captureExtensionTab(tabId) {
  if (!Number.isFinite(tabId)) {
    return { ok: false, reason: "tabId is required for echo.ext-capture-text." };
  }
  try {
    const result = await enqueueEchoExtensionCommand("capture-tab", { tabId });
    if (!result?.ok) {
      return {
        ok: false,
        reason: result?.reason ?? "echo-extension capture-tab failed.",
      };
    }
    return {
      ok: true,
      message: result.message ?? `Captured tab ${tabId} via echo-extension.`,
      snapshot: result.snapshot,
      bridge: getEchoExtensionBridgeStatus(),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "echo-extension capture-tab failed.",
      bridge: getEchoExtensionBridgeStatus(),
    };
  }
}

async function captureExtensionActiveTab() {
  try {
    const result = await enqueueEchoExtensionCommand("capture-active");
    if (!result?.ok) {
      return {
        ok: false,
        reason: result?.reason ?? "echo-extension capture-active failed.",
      };
    }
    return {
      ok: true,
      message: result.message ?? "Captured active tab via echo-extension.",
      snapshot: result.snapshot,
      bridge: getEchoExtensionBridgeStatus(),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "echo-extension capture-active failed.",
      bridge: getEchoExtensionBridgeStatus(),
    };
  }
}

async function executeScreenshot() {
  try {
    // JPEG keeps cloud-relay / Upstash payloads under request-size caps.
    const capture = await capturePrimaryMonitorJpeg();
    return {
      ok: true,
      message: `Screenshot ${capture.width}×${capture.height} captured on Echo (JPEG ${Math.round(capture.bytes / 1024)} KB).`,
      pngBase64: capture.pngBase64,
      mimeType: capture.mimeType,
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

async function readClipboardPayload() {
  const text = clipboard.readText()?.trim() ?? "";
  const image = clipboard.readImage();
  const hasImage = image && !image.isEmpty();
  const formats = clipboard.availableFormats();

  if (!text && !hasImage) {
    return {
      ok: false,
      reason: "Nothing on Echo clipboard — Ctrl+C the problem text on the interview machine, then retry.",
    };
  }

  let pngBase64;
  if (hasImage) {
    pngBase64 = image.toPNG().toString("base64");
  }

  return {
    ok: true,
    message: hasImage
      ? `Read Echo clipboard (${text ? "text + image" : "image"}).`
      : `Read ${text.length} characters from Echo clipboard.`,
    clipboard: {
      text: text || undefined,
      hasImage,
      formats,
    },
    pngBase64,
  };
}

async function readClipboard() {
  try {
    return await readClipboardPayload();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Read clipboard failed.",
    };
  }
}

async function copySelected() {
  try {
    let text = clipboard.readText()?.trim() ?? "";
    const fromExistingClipboard = Boolean(text);

    // If the operator already copied, use clipboard as-is — more reliable than synthetic Ctrl+C.
    if (!text && process.platform === "darwin") {
      execFileSync("osascript", [
        "-e",
        'tell application "System Events" to keystroke "c" using command down',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 180));
      text = clipboard.readText()?.trim() ?? "";
    } else if (!text && process.platform === "win32") {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-STA",
          "-Command",
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c'); Start-Sleep -Milliseconds 250",
        ],
        { stdio: "ignore", timeout: 5000 },
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      text = clipboard.readText()?.trim() ?? "";
    }

    const image = clipboard.readImage();
    const hasImage = image && !image.isEmpty();
    const formats = clipboard.availableFormats();

    if (!text && !hasImage) {
      return {
        ok: false,
        reason:
          process.platform === "darwin" || process.platform === "win32"
            ? "Nothing on Echo clipboard — select content on the Echo machine, then retry."
            : "Copy Selected is supported on Echo macOS and Windows today.",
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
        : fromExistingClipboard
          ? `Using ${text.length} characters already on Echo clipboard.`
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
