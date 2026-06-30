import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { STALE_SCREEN_RECORDING_HINT } from "./screen-permission-mac.mjs";

const execFileAsync = promisify(execFile);

/** @param {Buffer} pngBuffer */
function readPngDimensions(pngBuffer) {
  if (pngBuffer.length < 24 || pngBuffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }
  return {
    width: pngBuffer.readUInt32BE(16),
    height: pngBuffer.readUInt32BE(20),
  };
}

/**
 * @param {string[]} args
 * @param {string} outPath
 */
async function runScreencapture(args, outPath) {
  await execFileAsync("/usr/sbin/screencapture", [...args, outPath], {
    timeout: 20_000,
  });
}

/**
 * Full desktop capture via macOS screencapture CLI (includes other app windows).
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource: string }>}
 */
export async function captureViaMacScreencapture() {
  if (process.platform !== "darwin") {
    throw new Error("screencapture is macOS only.");
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "echo-sat-capture-"));
  const outPath = path.join(dir, "screen.png");
  const attempts = [
    ["-x", "-m"],
    ["-x"],
    ["-x", "-D", "1"],
  ];

  let lastError = "screencapture failed.";
  try {
    for (const args of attempts) {
      try {
        await runScreencapture(args, outPath);
        const pngBuffer = await readFile(outPath);
        if (!pngBuffer.length) {
          lastError = "screencapture returned an empty file.";
          continue;
        }

        const dimensions = readPngDimensions(pngBuffer);
        if (!dimensions?.width || !dimensions?.height) {
          lastError = "screencapture returned an unreadable PNG.";
          continue;
        }

        return {
          pngBase64: pngBuffer.toString("base64"),
          width: dimensions.width,
          height: dimensions.height,
          pngBuffer,
          captureSource: "screencapture",
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (/could not create image from display/i.test(lastError)) {
      throw new Error(`${lastError} — ${STALE_SCREEN_RECORDING_HINT}`);
    }
    throw new Error(lastError);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** @returns {Promise<{ ok: true } | { ok: false, error: string }>} */
export async function probeMacFullDesktopCapture() {
  try {
    await captureViaMacScreencapture();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
