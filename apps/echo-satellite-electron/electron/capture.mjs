import { Monitor } from "node-screenshots";

export async function capturePrimaryMonitorPngBase64() {
  const monitors = Monitor.all();
  const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
  if (!primary) {
    throw new Error("No display found for capture.");
  }
  const image = await primary.captureImage();
  const png = image.toPngSync();
  if (!png?.length) {
    throw new Error("Capture returned an empty image.");
  }
  return Buffer.from(png).toString("base64");
}

export async function capturePrimaryMonitorDimensions() {
  const monitors = Monitor.all();
  const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
  if (!primary) return null;
  return { width: primary.width, height: primary.height };
}
