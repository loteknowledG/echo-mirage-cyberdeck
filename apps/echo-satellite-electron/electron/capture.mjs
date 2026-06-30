import { Monitor } from "node-screenshots";

const CAPTURE_TIMEOUT_MS = 20_000;

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
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer }>}
 */
export async function capturePrimaryMonitorPng() {
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

  const width = image.width();
  const height = image.height();
  if (!width || !height) {
    throw new Error("Capture returned zero-size image — check Screen Recording permission.");
  }

  const pngBuffer = Buffer.from(png);
  return {
    pngBase64: pngBuffer.toString("base64"),
    width,
    height,
    pngBuffer,
  };
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
  return { width: primary.width(), height: primary.height() };
}
