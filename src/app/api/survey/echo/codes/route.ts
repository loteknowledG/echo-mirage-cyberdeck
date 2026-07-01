import { NextResponse } from "next/server";
import {
  getEchoSurveyPairingStatus,
  refreshEchoSurveyPairCodes,
} from "@/lib/server/survey-echo-pairing.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Echo machine — read current Mirage + PowerFist pairing codes. */
export async function GET(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Echo codes are localhost-only." }, { status: 403 });
  }

  const status = await getEchoSurveyPairingStatus();
  return NextResponse.json({ ok: true, ...status });
}

/** Echo machine — regenerate both pairing codes. */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Echo codes are localhost-only." }, { status: 403 });
  }

  await refreshEchoSurveyPairCodes();
  const status = await getEchoSurveyPairingStatus();
  return NextResponse.json({ ok: true, ...status });
}
