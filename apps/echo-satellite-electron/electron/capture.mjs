import { Monitor } from "node-screenshots";
import { captureViaMacScreencapture } from "./capture-screencapture.mjs";

const CAPTURE_TIMEOUT_MS = 20_000;

/** @type {{ captureScreen: () => Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource?: string }> } | null} */
let electronBackend = null;

/** @type {string | null} */
let lastCaptureNote = null;

/** @param {{ captureScreen: () => Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource?: string }> }} backend */
export function setElectronCaptureBackend(backend) {
  electronBackend = backend;
}

export function getLastCaptureNote() {
  return lastCaptureNote;
}

/**
 * Monitor uses width()/height(); Image uses .width/.height properties.
 * @param {{ width?: number | (() => number), height?: number | (() => number) }} source
 */
export function readPixelSize(source) {
  const width = typeof source.width === "function" ? source.width() : Number(source.width);
  const height = typeof source.height === "function" ? source.height() : Number(source.height);
  return { width, height };
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 */
export function withCaptureTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource: string }>}
 */
export async function captureViaNodeScreenshots() {
  const monitors = Monitor.all();
  const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
  if (!primary) {
    throw new Error("No display found for capture.");
  }

  const image = await withCaptureTimeout(
    primary.captureImage(),
    CAPTURE_TIMEOUT_MS,
    "Capture timed out. On macOS, grant Screen Recording for Echo Satellite, then quit and reopen the app.",
  );

  const png = image.toPngSync();
  if (!png?.length) {
    throw new Error("Capture returned an empty image.");
  }

  const { width, height } = readPixelSize(image);
  if (!width || !height) {
    throw new Error("Capture returned zero-size image — check Screen Recording permission.");
  }

  const pngBuffer = Buffer.from(png);
  return {
    pngBase64: pngBuffer.toString("base64"),
    width,
    height,
    pngBuffer,
    captureSource: "node-screenshots",
  };
}

/**
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, captureSource: string }>}
 */
export async function capturePrimaryMonitorPng() {
  lastCaptureNote = null;

  if (process.platform === "darwin") {
    if (electronBackend) {
      try {
        const captured = await electronBackend.captureScreen();
        return { ...captured, captureSource: captured.captureSource ?? "desktopCapturer" };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        lastCaptureNote = `desktopCapturer failed (${reason}); trying screencapture…`;
      }
    }

    try {
      const captured = await captureViaMacScreencapture();
      if (lastCaptureNote) {
        lastCaptureNote = `${lastCaptureNote} using screencapture fallback.`;
      }
      return captured;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastCaptureNote = lastCaptureNote
        ? `${lastCaptureNote} screencapture failed (${reason}); trying node-screenshots…`
        : `screencapture failed (${reason}); trying node-screenshots…`;
    }
  }

  const captured = await captureViaNodeScreenshots();
  if (process.platform === "darwin" && captured.captureSource === "node-screenshots") {
    lastCaptureNote =
      (lastCaptureNote ? `${lastCaptureNote} ` : "") +
      "node-screenshots may only show wallpaper + Echo Satellite — not other apps.";
  }
  return captured;
}

/** @deprecated Use capturePrimaryMonitorPng(). */
export async function capturePrimaryMonitorPngBase64() {
  const capture = await capturePrimaryMonitorPng();
  return capture.pngBase64;
}

/** @deprecated Use capturePrimaryMonitorPng(). */
export async function capturePrimaryMonitorDimensions() {
  const monitors = Monitor.all();
  const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
  if (!primary) return null;
  return readPixelSize(primary);
}
