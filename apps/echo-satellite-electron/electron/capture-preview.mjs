import { nativeImage } from "electron";

/**
 * @param {Buffer} pngBuffer
 * @returns {string | null}
 */
export function createCapturePreviewBase64(pngBuffer) {
  const preview = nativeImage.createFromBuffer(pngBuffer).resize({ width: 480 });
  if (preview.isEmpty()) {
    return null;
  }
  return preview.toJPEG(82).toString("base64");
}
