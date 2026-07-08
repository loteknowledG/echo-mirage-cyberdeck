import { NextResponse } from "next/server";
import { ensurePowerfistWsServer, broadcastPowerfistMissionToCapture } from "@/lib/server/powerfist-ws-server.server";
import { buildSilentCaptureMissionEnvelope } from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desktop test trigger — simulates PowerFist Survey Capture mission (Mirage hub). */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Trigger is localhost-only." }, { status: 403 });
  }

  await ensurePowerfistWsServer();
  const built = await buildSilentCaptureMissionEnvelope();
  if (!built.ok) {
    return NextResponse.json(built, { status: 503 });
  }

  const delivered = await broadcastPowerfistMissionToCapture(built.envelope);
  return NextResponse.json({
    ok: delivered > 0,
    missionId: built.envelope.missionId,
    delivered,
    reason: delivered > 0 ? undefined : "Echo capture desk offline.",
  });
}
