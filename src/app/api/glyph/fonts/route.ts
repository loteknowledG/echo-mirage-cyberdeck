import { NextResponse } from "next/server";
import { listFigletFonts } from "@/lib/figlet-fonts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fonts = await listFigletFonts();
    return NextResponse.json({ ok: true, fonts });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to list figlet fonts",
      },
      { status: 500 },
    );
  }
}
