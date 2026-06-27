import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deprecated — use /api/powerfist/pairing/deck (localhost) or QR pairing. */
export async function GET() {
  return NextResponse.json({
    ok: false,
    reason: "Use Settings → PowerFist to scan a QR code. Legacy token pairing is disabled.",
  });
}
