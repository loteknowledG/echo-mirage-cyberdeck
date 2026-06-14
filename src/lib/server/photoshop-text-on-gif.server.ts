// SERVER ONLY: GIF caption rendering (text-on-gif algorithm via @napi-rs/canvas).

import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import GIFEncoder from "gif-encoder-2";
import gifFrames from "gif-frames";

import type {
  PhotoshopTextAlignmentX,
  PhotoshopTextAlignmentY,
} from "@/lib/photoshop-text-on-gif";

export type PhotoshopTextOnGifInput = {
  gifBuffer: Buffer;
  fileName: string;
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

export type PhotoshopTextOnGifResult =
  | { ok: true; buffer: Buffer; fileName: string }
  | { ok: false; error: string };

type ExtractedFrame = {
  image: Image;
  delay: number;
  disposal: number;
};

type GifTextContext = {
  font: string;
  textAlign: string;
  textBaseline: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  measureText(text: string): { width: number };
  strokeText(text: string, x: number, y: number): void;
  fillText(text: string, x: number, y: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: Image, x: number, y: number): void;
  getImageData(x: number, y: number, width: number, height: number): ImageData;
  putImageData(data: ImageData, x: number, y: number): void;
};

function outputFileName(sourceName: string): string {
  const base = sourceName.replace(/\.gif$/i, "") || "gif";
  return `${base}-caption.gif`;
}

async function readStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function streamToImage(stream: NodeJS.ReadableStream): Promise<Image> {
  const pngBuffer = await readStreamToBuffer(stream);
  return loadImage(pngBuffer);
}

async function extractGifFrames(gifBuffer: Buffer): Promise<{ width: number; height: number; frames: ExtractedFrame[] }> {
  const frameData = await gifFrames({
    url: gifBuffer,
    frames: "all",
    outputType: "png",
    cumulative: true,
  });

  if (frameData.length === 0) {
    throw new Error("GIF has no frames.");
  }

  const width = frameData[0].frameInfo.width;
  const height = frameData[0].frameInfo.height;
  const frames: ExtractedFrame[] = [];

  for (const frame of frameData) {
    frames.push({
      image: await streamToImage(frame.getImage()),
      delay: frame.frameInfo.delay * 10,
      disposal: frame.frameInfo.disposal,
    });
  }

  return { width, height, frames };
}

type TextRow = { text: string; width: number };

function layoutTextRows(ctx: GifTextContext, text: string, maxWidth: number): TextRow[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text: "", width: 0 }];

  const spaceWidth = ctx.measureText("M M").width - ctx.measureText("M").width * 2;
  const rows: TextRow[] = [{ text: `${words[0]} `, width: ctx.measureText(words[0]).width + spaceWidth }];

  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    const wordWidth = ctx.measureText(word).width + spaceWidth;
    const last = rows[rows.length - 1];
    if (last.width + wordWidth <= maxWidth) {
      last.text += `${word} `;
      last.width += wordWidth;
    } else {
      rows.push({ text: `${word} `, width: wordWidth });
    }
  }

  return rows;
}

function resolveTextPosition(options: {
  width: number;
  height: number;
  rows: TextRow[];
  alignmentX: PhotoshopTextAlignmentX;
  alignmentY: PhotoshopTextAlignmentY;
  offsetX: number;
  offsetY: number;
  rowGap: number;
  approximateLineHeight: number;
  ctx: GifTextContext;
}): { x: number; y: number } {
  const { width, height, rows, alignmentX, alignmentY, offsetX, offsetY, rowGap, approximateLineHeight, ctx } =
    options;

  let x: number;
  if (alignmentX === "right") {
    ctx.textAlign = "right";
    x = width - offsetX;
  } else if (alignmentX === "left") {
    ctx.textAlign = "left";
    x = offsetX;
  } else {
    ctx.textAlign = "center";
    x = width / 2;
  }

  let y: number;
  if (rows.length === 1) {
    if (alignmentY === "top") {
      ctx.textBaseline = "alphabetic";
      y = offsetY + approximateLineHeight;
    } else if (alignmentY === "middle") {
      ctx.textBaseline = "middle";
      y = height / 2;
    } else {
      ctx.textBaseline = "alphabetic";
      y = height - offsetY;
    }
  } else if (alignmentY === "top") {
    ctx.textBaseline = "alphabetic";
    y = offsetY + approximateLineHeight;
  } else if (alignmentY === "middle") {
    ctx.textBaseline = "top";
    y = (height - (rows.length * approximateLineHeight + (rows.length - 1) * rowGap)) / 2 + approximateLineHeight;
  } else {
    ctx.textBaseline = "alphabetic";
    y = height - ((rows.length - 1) * (approximateLineHeight + rowGap) + offsetY);
  }

  return { x, y };
}

function drawCaption(
  ctx: GifTextContext,
  text: string,
  rows: TextRow[],
  x: number,
  y: number,
  rowGap: number,
  approximateLineHeight: number,
  strokeColor: string,
  strokeWidth: number,
  font: string,
  fontColor: string,
): void {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.font = font;
  ctx.fillStyle = fontColor;

  if (rows.length === 1) {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    return;
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const line = rows[rowIndex].text.trimEnd();
    const lineY = rowIndex * (approximateLineHeight + rowGap) + y;
    ctx.strokeText(line, x, lineY);
    ctx.fillText(line, x, lineY);
  }
}

export async function applyTextOnGifServer(
  input: PhotoshopTextOnGifInput,
): Promise<PhotoshopTextOnGifResult> {
  if (!input.text.trim()) {
    return { ok: false, error: "Text is required." };
  }

  try {
    const fontSize = input.fontSize ?? "32px";
    const fontStyle = input.fontStyle ?? "Arial";
    const fontColor = input.fontColor ?? "white";
    const strokeColor = input.strokeColor ?? "black";
    const strokeWidth = input.strokeWidth ?? 2;
    const alignmentX = input.alignmentX ?? "center";
    const alignmentY = input.alignmentY ?? "bottom";
    const offsetX = input.offsetX ?? 10;
    const offsetY = input.offsetY ?? 10;
    const rowGap = 5;

    const { width, height, frames } = await extractGifFrames(input.gifBuffer);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d") as unknown as GifTextContext;
    const font = `${fontSize} ${fontStyle}`;
    ctx.font = font;

    const rows = layoutTextRows(ctx, input.text.trim(), width);
    const approximateLineHeight = ctx.measureText("M").width;
    const { x, y } = resolveTextPosition({
      width,
      height,
      rows,
      alignmentX,
      alignmentY,
      offsetX,
      offsetY,
      rowGap,
      approximateLineHeight,
      ctx,
    });

    const encoder = new GIFEncoder(width, height, "neuquant", false, frames.length);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    for (const frame of frames) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(frame.image, 0, 0);

      const snapshot = frame.disposal !== 2 ? ctx.getImageData(0, 0, width, height) : null;

      drawCaption(
        ctx,
        input.text.trim(),
        rows,
        x,
        y,
        rowGap,
        approximateLineHeight,
        strokeColor,
        strokeWidth,
        font,
        fontColor,
      );

      encoder.setDelay(frame.delay);
      encoder.setDispose(frame.disposal);
      encoder.addFrame(ctx as never);

      if (frame.disposal === 2) {
        ctx.clearRect(0, 0, width, height);
      } else if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
      }
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    return {
      ok: true,
      buffer,
      fileName: outputFileName(input.fileName),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not process GIF.",
    };
  }
}
