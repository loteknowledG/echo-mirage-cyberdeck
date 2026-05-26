import { NextRequest, NextResponse } from "next/server";
import { renderGlyph, type GlyphRenderRequest } from "@/lib/glyph-render.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GlyphRenderRequest>;
    const engine = body.engine;
    const text = typeof body.text === "string" ? body.text : "";

    if (engine !== "ascii" && engine !== "figlet") {
      return NextResponse.json({ ok: false, error: "engine must be ascii or figlet" }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
    }

    const output = await renderGlyph({
      engine,
      text,
      font: typeof body.font === "string" ? body.font : undefined,
      decorate: body.decorate !== false,
    });

    return NextResponse.json({ ok: true, output, engine });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Glyph render failed",
      },
      { status: 500 },
    );
  }
}
