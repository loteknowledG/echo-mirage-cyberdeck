import { NextResponse } from "next/server";
import {
  resolveSurveyRelayListeningSnapshot,
  surveyRelayStorageMode,
} from "@/lib/server/survey-cloud-relay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Mirage polls the latest Echo listening / STT snapshot. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const echoNodeId = searchParams.get("echoNodeId")?.trim() || null;
  const wantActive = searchParams.get("active") === "1" || searchParams.get("active") === "true";

  if (!echoNodeId && !wantActive) {
    return NextResponse.json(
      {
        ok: false,
        reason: "echoNodeId query param is required (or pass active=1).",
      },
      { status: 400, headers: CORS },
    );
  }

  const resolved = await resolveSurveyRelayListeningSnapshot(wantActive ? null : echoNodeId);
  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        reason: "No listening snapshot yet — Start Listening on Echo.",
        storage: surveyRelayStorageMode(),
      },
      { status: 404, headers: CORS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      listening: resolved.listening,
      source: resolved.source,
      storage: surveyRelayStorageMode(),
    },
    { headers: CORS },
  );
}
