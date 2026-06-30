import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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
 * Full desktop capture via macOS screencapture CLI (includes other app windows).
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource: string }>}
 */
export async function captureViaMacScreencapture() {
  if (process.platform !== "darwin") {
    throw new Error("screencapture is macOS only.");
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "echo-sat-capture-"));
  const outPath = path.join(dir, "screen.png");
  try {
    await execFileAsync("/usr/sbin/screencapture", ["-x", "-m", outPath], {
      timeout: 20_000,
    });
    const pngBuffer = await readFile(outPath);
    if (!pngBuffer.length) {
      throw new Error("screencapture returned an empty file.");
    }

    const dimensions = readPngDimensions(pngBuffer);
    if (!dimensions?.width || !dimensions?.height) {
      throw new Error("screencapture returned an unreadable PNG.");
    }

    return {
      pngBase64: pngBuffer.toString("base64"),
      width: dimensions.width,
      height: dimensions.height,
      pngBuffer,
      captureSource: "screencapture",
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
