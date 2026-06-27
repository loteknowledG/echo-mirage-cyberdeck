import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import { completePowerfistCapturePair } from "@/lib/server/powerfist-pairing-registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CapturePairBody = {
  pairId?: string;
  pairSecret?: string;
  nodeId?: string;
  label?: string;
};

export async function POST(request: Request) {
  await ensurePowerfistWsServer();

  let body: CapturePairBody;
  try {
    body = (await request.json()) as CapturePairBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON body." }, { status: 400 });
  }

  const pairId = body.pairId?.trim();
  const pairSecret = body.pairSecret?.trim();
  const nodeId = body.nodeId?.trim();
  if (!pairId || !pairSecret || !nodeId) {
    return NextResponse.json(
      { ok: false, reason: "pairId, pairSecret, and nodeId are required." },
      { status: 400 },
    );
  }

  const result = await completePowerfistCapturePair({
    pairId,
    pairSecret,
    nodeId,
    label: body.label?.trim(),
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json(result);
}
