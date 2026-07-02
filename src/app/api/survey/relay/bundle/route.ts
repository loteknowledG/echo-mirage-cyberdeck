import { NextResponse } from "next/server";
import {
  loadSurveyRelayBundle,
  saveSurveyRelayBundle,
  surveyRelayStorageMode,
  verifySurveyRelaySecret,
} from "@/lib/server/survey-cloud-relay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: CORS });
}

type BundleBody = {
  echoNodeId?: string;
  echoHost?: string;
  httpPort?: number;
  miragePin?: string;
  powerfistPin?: string | null;
  sessionEpoch?: number;
  echoSurveyActive?: boolean;
};

/** Echo pushes pairing bundle to the cloud relay (HTTPS out). */
export async function POST(request: Request) {
  if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, reason: "Relay authorization failed." }, { status: 401, headers: CORS });
  }

  let body: BundleBody;
  try {
    body = (await request.json()) as BundleBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400, headers: CORS });
  }

  const echoNodeId = body.echoNodeId?.trim();
  const echoHost = body.echoHost?.trim();
  const miragePin = body.miragePin?.trim();
  const httpPort = Number(body.httpPort) || 3050;

  if (!echoNodeId || !echoHost || !miragePin) {
    return NextResponse.json(
      { ok: false, reason: "echoNodeId, echoHost, and miragePin are required." },
      { status: 400, headers: CORS },
    );
  }

  const bundle = await saveSurveyRelayBundle({
    echoNodeId,
    echoHost,
    httpPort,
    miragePin,
    powerfistPin: body.powerfistPin?.trim() || null,
    sessionEpoch: body.sessionEpoch ?? 1,
    echoSurveyActive: body.echoSurveyActive !== false,
  });

  return NextResponse.json({
    ok: true,
    storage: surveyRelayStorageMode(),
    echoNodeId: bundle.echoNodeId,
    expiresAt: bundle.expiresAt,
  }, { headers: CORS });
}

/** Mirage fetches the latest bundle for an Echo team id. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const echoNodeId = searchParams.get("echoNodeId")?.trim();
  if (!echoNodeId) {
    return NextResponse.json(
      { ok: false, reason: "echoNodeId query param is required." },
      { status: 400, headers: CORS },
    );
  }

  const bundle = await loadSurveyRelayBundle(echoNodeId);
  if (!bundle) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "No relay bundle yet — on Echo Mac open Echo Satellite and tap Send to Mirage (or wait for auto-push).",
        storage: surveyRelayStorageMode(),
      },
      { status: 404, headers: CORS },
    );
  }

  return NextResponse.json({ ok: true, bundle, storage: surveyRelayStorageMode() }, { headers: CORS });
}
