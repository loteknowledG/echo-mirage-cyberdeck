import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, net, nativeImage, protocol } from "electron";

export const CAPTURE_PREVIEW_SCHEME = "satellite-preview";

protocol.registerSchemesAsPrivileged([
  {
    scheme: CAPTURE_PREVIEW_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

export function registerCapturePreviewProtocol() {
  protocol.handle(CAPTURE_PREVIEW_SCHEME, (request) => {
    const prefix = `${CAPTURE_PREVIEW_SCHEME}://`;
    const filePath = decodeURIComponent(request.url.slice(prefix.length));
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

/**
 * @param {Buffer} pngBuffer
 * @returns {Promise<string | null>}
 */
export async function writeCapturePreviewUrl(pngBuffer) {
  const preview = nativeImage.createFromBuffer(pngBuffer).resize({ width: 480 });
  if (preview.isEmpty()) {
    return null;
  }

  const jpeg = preview.toJPEG(82);
  const previewPath = path.join(app.getPath("temp"), "echo-satellite-capture-preview.jpg");
  await fs.writeFile(previewPath, jpeg);
  return `${CAPTURE_PREVIEW_SCHEME}://${encodeURIComponent(previewPath)}`;
}
