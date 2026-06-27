import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import { unpairPowerfistRemote } from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Unpair is desktop-only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  await unpairPowerfistRemote();
  return NextResponse.json({ ok: true });
}
