import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import {
  createPowerfistQrSession,
  getPowerfistQrSessionForDesktop,
} from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "QR pairing is desktop-only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  const session = await getPowerfistQrSessionForDesktop();
  return NextResponse.json(session);
}

/** Generate a fresh QR pairing session (invalidates any previous QR). */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "QR pairing is desktop-only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  try {
    const session = await createPowerfistQrSession();
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Failed to create pairing QR.",
      },
      { status: 503 },
    );
  }
}
