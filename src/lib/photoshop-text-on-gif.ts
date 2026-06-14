/** Client-safe types for Photoshop GIF text overlay API. */

export type PhotoshopTextAlignmentX = "left" | "center" | "right";
export type PhotoshopTextAlignmentY = "top" | "middle" | "bottom";

export type PhotoshopTextOnGifOptions = {
  text: string;
  fontSize?: string;
  fontColor?: string;
  fontStyle?: string;
  strokeColor?: string;
  strokeWidth?: number;
  alignmentX?: PhotoshopTextAlignmentX;
  alignmentY?: PhotoshopTextAlignmentY;
  offsetX?: number;
  offsetY?: number;
};

export type PhotoshopTextOnGifResponse =
  | { ok: true; fileName: string; mimeType: "image/gif"; base64: string }
  | { ok: false; error: string };

export function isAnimatedGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

export async function applyTextOnGifViaApi(
  gifFile: File,
  options: PhotoshopTextOnGifOptions,
): Promise<PhotoshopTextOnGifResponse> {
  const form = new FormData();
  form.append("gif", gifFile);
  form.append("text", options.text);
  if (options.fontSize) form.append("fontSize", options.fontSize);
  if (options.fontColor) form.append("fontColor", options.fontColor);
  if (options.fontStyle) form.append("fontStyle", options.fontStyle);
  if (options.strokeColor) form.append("strokeColor", options.strokeColor);
  if (options.strokeWidth != null) form.append("strokeWidth", String(options.strokeWidth));
  if (options.alignmentX) form.append("alignmentX", options.alignmentX);
  if (options.alignmentY) form.append("alignmentY", options.alignmentY);
  if (options.offsetX != null) form.append("offsetX", String(options.offsetX));
  if (options.offsetY != null) form.append("offsetY", String(options.offsetY));

  try {
    const res = await fetch("/api/photoshop/text-on-gif", {
      method: "POST",
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as PhotoshopTextOnGifResponse;
    if (!res.ok || !payload.ok) {
      return { ok: false, error: payload.ok === false ? payload.error : `Request failed (${res.status})` };
    }
    return payload;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not apply text to GIF.",
    };
  }
}
