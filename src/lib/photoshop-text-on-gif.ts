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
  /** Absolute caption origin in GIF pixels (top-left). Overrides alignment when set. */
  positionX?: number;
  positionY?: number;
};

export type PhotoshopTextOnGifResponse =
  | { ok: true; fileName: string; mimeType: "image/gif"; base64: string }
  | { ok: false; error: string };

export function isAnimatedGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

export type CaptionLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function parseFontSizePx(fontSize: string): number {
  const match = fontSize.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : 32;
}

/** Estimate caption box for preview drag + default placement (browser canvas). */
export function measureCaptionLayout(
  text: string,
  fontSize: string,
  imageWidth: number,
  imageHeight: number,
  alignmentX: PhotoshopTextAlignmentX = "center",
  alignmentY: PhotoshopTextAlignmentY = "bottom",
  offsetX = 10,
  offsetY = 10,
): CaptionLayout {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !text.trim() || imageWidth <= 0 || imageHeight <= 0) {
    return { x: offsetX, y: offsetY, width: 0, height: parseFontSizePx(fontSize) };
  }

  const fontPx = parseFontSizePx(fontSize);
  ctx.font = `${fontSize} Arial`;
  const lineHeight = fontPx;
  const rowGap = 5;
  const words = text.trim().split(/\s+/);
  const rows: string[] = [];
  let current = words[0] ?? "";

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= imageWidth - offsetX * 2) {
      current = candidate;
    } else {
      rows.push(current);
      current = words[i];
    }
  }
  if (current) rows.push(current);

  const width = Math.max(...rows.map((row) => ctx.measureText(row).width), 0);
  const height = rows.length * lineHeight + Math.max(0, rows.length - 1) * rowGap;

  let x = offsetX;
  if (alignmentX === "center") x = Math.max(0, (imageWidth - width) / 2);
  else if (alignmentX === "right") x = Math.max(0, imageWidth - width - offsetX);

  let y = offsetY;
  if (alignmentY === "middle") y = Math.max(0, (imageHeight - height) / 2);
  else if (alignmentY === "bottom") y = Math.max(0, imageHeight - height - offsetY);

  return { x, y, width, height };
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
  if (options.positionX != null) form.append("positionX", String(options.positionX));
  if (options.positionY != null) form.append("positionY", String(options.positionY));

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
