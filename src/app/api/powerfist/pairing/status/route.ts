import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import { getPowerfistPairingStatus } from "@/lib/server/powerfist-pairing-registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public status only — no secrets. */
export async function GET() {
  await ensurePowerfistWsServer();
  const status = await getPowerfistPairingStatus();
  return NextResponse.json(status);
}
