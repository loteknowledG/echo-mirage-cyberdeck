import { NextRequest, NextResponse } from "next/server";
import { getDropStore } from "@/lib/dropbay/dropbay-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const drops = await getDropStore().listDrops({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return NextResponse.json({ ok: true, drops });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not list drops." },
      { status: 500 },
    );
  }
}
