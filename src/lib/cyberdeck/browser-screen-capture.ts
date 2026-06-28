/** Browser screen capture for Espionage Echo (getDisplayMedia → PNG base64). */

export type BrowserScreenCaptureResult =
  | { ok: true; pngBase64: string }
  | { ok: false; error: string; cancelled?: boolean };

export function isBrowserScreenCaptureSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

function isUserCancelledCaptureError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  if (error.name === "NotAllowedError" || error.name === "AbortError") return true;
  const message = error.message.toLowerCase();
  return message.includes("permission") || message.includes("cancel");
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video stream failed before first frame."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/** Prompts the operator to pick a screen/window, then returns one PNG frame as base64. */
export async function captureBrowserScreenPngBase64(): Promise<BrowserScreenCaptureResult> {
  if (!isBrowserScreenCaptureSupported()) {
    return {
      ok: false,
      error: "Browser screen capture is not supported here. Use Chrome/Edge on desktop over HTTPS or localhost.",
    };
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const [track] = stream.getVideoTracks();
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();
    await waitForVideoFrame(video);

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return { ok: false, error: "Captured stream had no video dimensions." };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { ok: false, error: "Could not create canvas for screenshot." };
    }
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/png");
    const pngBase64 = dataUrl.split(",")[1]?.trim() ?? "";
    if (!pngBase64) {
      return { ok: false, error: "Failed to encode screenshot as PNG." };
    }

    track?.stop();
    return { ok: true, pngBase64 };
  } catch (error) {
    if (isUserCancelledCaptureError(error)) {
      return { ok: false, error: "Screen capture cancelled.", cancelled: true };
    }
    const message = error instanceof Error ? error.message : "Screen capture failed.";
    return { ok: false, error: message };
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}
