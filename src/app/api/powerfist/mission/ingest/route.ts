import { NextResponse } from "next/server";
import { ensurePowerfistWsServer, broadcastPowerfistMissionSolve } from "@/lib/server/powerfist-ws-server.server";
import {
  ensurePowerfistMissionSecret,
  loadPowerfistPairingRegistry,
} from "@/lib/server/powerfist-pairing-registry.server";
import { storePowerfistMission } from "@/lib/server/powerfist-mission-store.server";
import type { PowerfistMissionKind } from "@/lib/cyberdeck/powerfist-mission.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IngestBody = {
  missionId?: string;
  kind?: PowerfistMissionKind;
  missionSecret?: string;
  prompt?: string;
  pngBase64?: string;
};

/** Capture desk POSTs screenshot here (solver hub). */
export async function POST(request: Request) {
  await ensurePowerfistWsServer();
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return NextResponse.json({ ok: false, reason: "Solver hub offline." }, { status: 503 });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const missionId = body.missionId?.trim();
  const missionSecret = body.missionSecret?.trim();
  const pngBase64 = body.pngBase64?.trim();
  const kind = body.kind ?? "silent-capture-solve";
  const prompt =
    body.prompt?.trim() ||
    "Analyze the coding question in the attached screenshot. Provide a clear explanation and working code solution. Be concise and interview-ready.";

  if (!missionId || !missionSecret || !pngBase64) {
    return NextResponse.json(
      { ok: false, reason: "missionId, missionSecret, and pngBase64 are required." },
      { status: 400 },
    );
  }

  const expectedSecret = await ensurePowerfistMissionSecret(state);
  if (missionSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, reason: "Invalid mission secret." }, { status: 403 });
  }

  await storePowerfistMission({ missionId, kind, prompt, pngBase64 });
  const imageDataUrl = `data:image/png;base64,${pngBase64}`;
  const delivered = broadcastPowerfistMissionSolve({
    missionId,
    kind,
    imageDataUrl,
    prompt,
  });

  return NextResponse.json({ ok: true, missionId, delivered });
}
