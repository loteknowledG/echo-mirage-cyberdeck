import { NextResponse } from "next/server";
import { unpairPowerfistCapture } from "@/lib/server/powerfist-pairing-registry.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Echo unpair is Mirage-hub only." }, { status: 403 });
  }

  await unpairPowerfistCapture();
  return NextResponse.json({ ok: true });
}
