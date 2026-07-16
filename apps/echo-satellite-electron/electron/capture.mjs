import { Monitor } from "node-screenshots";

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
 * @returns {Promise<import("node-screenshots").Image>}
 */
async function capturePrimaryImage() {
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

  const { width, height } = readPixelSize(image);
  if (!width || !height) {
    throw new Error("Capture returned zero-size image — check Screen Recording permission.");
  }

  return image;
}

/**
 * @returns {Promise<{ pngBase64: string, width: number, height: number, pngBuffer: Buffer, mimeType: string }>}
 */
export async function capturePrimaryMonitorPng() {
  const image = await capturePrimaryImage();
  const png = image.toPngSync();
  if (!png?.length) {
    throw new Error("Capture returned an empty image.");
  }

  const { width, height } = readPixelSize(image);
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
 * Uses node-screenshots (no Electron import — smoke tests run under plain Node).
 * `pngBase64` keeps the wire field name; payload is JPEG (`mimeType: image/jpeg`).
 *
 * @returns {Promise<{ pngBase64: string, width: number, height: number, mimeType: string, bytes: number }>}
 */
export async function capturePrimaryMonitorJpeg() {
  const image = await capturePrimaryImage();
  const jpeg = image.toJpegSync();
  if (!jpeg?.length) {
    throw new Error("JPEG encode failed.");
  }

  const { width, height } = readPixelSize(image);
  const jpegBuffer = Buffer.from(jpeg);
  return {
    pngBase64: jpegBuffer.toString("base64"),
    width,
    height,
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
