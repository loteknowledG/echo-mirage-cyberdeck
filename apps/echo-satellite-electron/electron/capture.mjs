import { Monitor } from "node-screenshots";
import { nativeImage } from "electron";

const CAPTURE_TIMEOUT_MS = 20_000;

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
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, mimeType: string }>}
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
    mimeType: "image/png",
  };
}

/**
 * Primary-display capture as JPEG (smaller for cloud relay / Upstash).
 * `pngBase64` keeps the wire field name; payload is JPEG (`mimeType: image/jpeg`).
 *
 * @param {number} [quality=72] electron nativeImage JPEG quality 0–100
 * @returns {Promise<{ pngBase64: string, width: number, height: number, mimeType: string, bytes: number }>}
 */
export async function capturePrimaryMonitorJpeg(quality = 72) {
  const capture = await capturePrimaryMonitorPng();
  const q = Math.min(100, Math.max(1, Number(quality) || 72));
  const jpegBuffer = nativeImage.createFromBuffer(capture.pngBuffer).toJPEG(q);
  if (!jpegBuffer?.length) {
    throw new Error("JPEG encode failed.");
  }
  return {
    pngBase64: jpegBuffer.toString("base64"),
    width: capture.width,
    height: capture.height,
    mimeType: "image/jpeg",
    bytes: jpegBuffer.length,
  };
}

export async function capturePrimaryMonitorPngBase64() {
  const capture = await capturePrimaryMonitorPng();
  return capture.pngBase64;
}

export async function capturePrimaryMonitorDimensions() {
  const monitors = Monitor.all();
  const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
  if (!primary) return null;
  return readPixelSize(primary);
}
