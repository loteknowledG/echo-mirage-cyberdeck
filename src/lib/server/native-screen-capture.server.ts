// SERVER ONLY — OS-native desktop capture (no mouse/keyboard side effects).

export type NativeScreenCaptureResult =
  | { ok: true; pngBase64: string }
  | { ok: false; error: string };

export async function captureNativeDesktopPng(): Promise<NativeScreenCaptureResult> {
  try {
    const { Monitor } = await import("node-screenshots");
    const monitors = Monitor.all();
    const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
    if (!primary) {
      return { ok: false, error: "No display found for native capture." };
    }

    const image = await primary.captureImage();
    const png = image.toPngSync();
    if (!png?.length) {
      return { ok: false, error: "Native capture returned an empty image." };
    }

    return { ok: true, pngBase64: Buffer.from(png).toString("base64") };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Native screen capture failed.",
    };
  }
}
