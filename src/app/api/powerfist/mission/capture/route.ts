import { NextResponse } from "next/server";
import { captureSilentDesktopPng } from "@/lib/server/powerfist-silent-capture.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Capture desk only — silent full-desktop screenshot. */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, error: "Capture API is localhost-only." }, { status: 403 });
  }

  const result = await captureSilentDesktopPng();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    pngBase64: result.pngBase64,
    mimeType: "image/png",
  });
}
