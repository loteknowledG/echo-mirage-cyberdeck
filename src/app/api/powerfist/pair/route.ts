import { NextResponse } from "next/server";
import { ensurePowerfistWsServer } from "@/lib/server/powerfist-ws-server.server";
import { completePowerfistPair, completePowerfistPairByPin } from "@/lib/server/powerfist-pairing-registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PairBody = {
  pairId?: string;
  pairSecret?: string;
  pin?: string;
  deviceId?: string;
};

/** Phone completes QR scan or Mirage hub PIN — returns a device-bound remote token. */
export async function POST(request: Request) {
  await ensurePowerfistWsServer();

  let body: PairBody;
  try {
    body = (await request.json()) as PairBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON body." }, { status: 400 });
  }

  const deviceId = body.deviceId?.trim();
  if (!deviceId) {
    return NextResponse.json({ ok: false, reason: "deviceId is required." }, { status: 400 });
  }

  const pin = body.pin?.trim();
  if (pin) {
    const result = await completePowerfistPairByPin({ pin, deviceId });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  }

  const pairId = body.pairId?.trim();
  const pairSecret = body.pairSecret?.trim();

  if (!pairId || !pairSecret) {
    return NextResponse.json(
      { ok: false, reason: "pairId and pairSecret, or pin, are required." },
      { status: 400 },
    );
  }

  const result = await completePowerfistPair({ pairId, pairSecret, deviceId });
  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json(result);
}
