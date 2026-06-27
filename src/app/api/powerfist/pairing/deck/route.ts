import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import { getPowerfistDeckConnectInfo } from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desktop-only: deck WebSocket URL (never exposes remote pairing secrets). */
export async function GET(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Deck pairing info is localhost-only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  const info = await getPowerfistDeckConnectInfo();
  if (!info.ok) {
    return NextResponse.json(info, { status: 503 });
  }
  return NextResponse.json(info);
}
