import { NextResponse } from "next/server";
import { terminateEchoSurveySession } from "@/lib/server/survey-echo-pairing.server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Echo machine — close Survey tab: disconnect all Mirage + PowerFist pairings. */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json(
      { ok: false, reason: "Echo terminate is localhost-only." },
      { status: 403 },
    );
  }

  const result = await terminateEchoSurveySession();
  return NextResponse.json(result);
}
