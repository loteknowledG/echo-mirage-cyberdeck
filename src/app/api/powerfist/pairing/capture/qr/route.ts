import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import {
  createPowerfistCaptureQrSession,
  getPowerfistQrSessionForDesktop,
} from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Capture QR is solver-hub only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  const session = await getPowerfistQrSessionForDesktop();
  return NextResponse.json({
    ok: true,
    capturePairUrl: session.capturePairUrl,
    expiresAt: session.captureExpiresAt,
    pairedCapture: session.pairedCapture,
  });
}

export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Capture QR is solver-hub only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  try {
    const session = await createPowerfistCaptureQrSession();
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Failed to create capture QR.",
      },
      { status: 503 },
    );
  }
}
