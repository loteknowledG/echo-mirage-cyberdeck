import { NextRequest, NextResponse } from "next/server";

import type {
  PhotoshopTextAlignmentX,
  PhotoshopTextAlignmentY,
} from "@/lib/photoshop-text-on-gif";
import { isAnimatedGifFile } from "@/lib/photoshop-text-on-gif";
import { applyTextOnGifServer } from "@/lib/server/photoshop-text-on-gif.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_GIF_BYTES = 12 * 1024 * 1024;

function parseAlignmentX(value: FormDataEntryValue | null): PhotoshopTextAlignmentX | undefined {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "left" || raw === "center" || raw === "right") return raw;
  return undefined;
}

function parseAlignmentY(value: FormDataEntryValue | null): PhotoshopTextAlignmentY | undefined {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "top" || raw === "middle" || raw === "bottom") return raw;
  return undefined;
}

function parseNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readFormString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const gifEntry = form.get("gif");
    const text = readFormString(form, "text") ?? "";

    if (!(gifEntry instanceof File)) {
      return NextResponse.json({ ok: false, error: "gif file is required." }, { status: 400 });
    }
    if (!isAnimatedGifFile(gifEntry)) {
      return NextResponse.json({ ok: false, error: "Only GIF files are supported." }, { status: 400 });
    }
    if (gifEntry.size > MAX_GIF_BYTES) {
      return NextResponse.json({ ok: false, error: "GIF exceeds 12 MB limit." }, { status: 400 });
    }

    const gifBuffer = Buffer.from(await gifEntry.arrayBuffer());
    const result = await applyTextOnGifServer({
      gifBuffer,
      fileName: gifEntry.name || "input.gif",
      text,
      fontSize: readFormString(form, "fontSize"),
      fontColor: readFormString(form, "fontColor"),
      fontStyle: readFormString(form, "fontStyle"),
      strokeColor: readFormString(form, "strokeColor"),
      strokeWidth: parseNumber(form.get("strokeWidth")),
      alignmentX: parseAlignmentX(form.get("alignmentX")),
      alignmentY: parseAlignmentY(form.get("alignmentY")),
      offsetX: parseNumber(form.get("offsetX")),
      offsetY: parseNumber(form.get("offsetY")),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      fileName: result.fileName,
      mimeType: "image/gif",
      base64: result.buffer.toString("base64"),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "GIF processing failed." },
      { status: 500 },
    );
  }
}
