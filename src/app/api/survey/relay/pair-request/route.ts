import { NextResponse } from "next/server";
import {
  createSurveyRelayPairRequest,
  loadSurveyRelayPairRequest,
  loadSurveyRelayPairResult,
  saveSurveyRelayPairResult,
  listPendingSurveyRelayPairRequests,
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
  return new NextResponse(null, { status: 204, headers: CORS });
}

type PairRequestBody = {
  echoNodeId?: string;
  role?: "mirage" | "powerfist";
  pin?: string;
  nodeId?: string;
  deviceId?: string;
};

/** Mirage submits a pair attempt via cloud relay (no direct Echo HTTP). */
export async function POST(request: Request) {
  let body: PairRequestBody;
  try {
    body = (await request.json()) as PairRequestBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400, headers: CORS });
  }

  const echoNodeId = body.echoNodeId?.trim();
  const role = body.role;
  const pin = body.pin?.trim();

  if (!echoNodeId || (role !== "mirage" && role !== "powerfist") || !pin) {
    return NextResponse.json(
      { ok: false, reason: "echoNodeId, role (mirage|powerfist), and pin are required." },
      { status: 400, headers: CORS },
    );
  }

  const pairRequest = await createSurveyRelayPairRequest({
    echoNodeId,
    role,
    pin,
    nodeId: body.nodeId,
    deviceId: body.deviceId,
  });

  return NextResponse.json({
    ok: true,
    requestId: pairRequest.requestId,
    storage: surveyRelayStorageMode(),
  }, { headers: CORS });
}

/** Poll pair result (Mirage) or list pending requests (Echo with auth). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId")?.trim();
  const echoNodeId = searchParams.get("echoNodeId")?.trim();

  if (requestId) {
    const result = await loadSurveyRelayPairResult(requestId);
    if (!result) {
      const pending = await loadSurveyRelayPairRequest(requestId);
      if (pending?.status === "pending") {
        return NextResponse.json({ ok: true, pending: true, requestId }, { headers: CORS });
      }
      return NextResponse.json({ ok: false, reason: "Pair request not found or expired." }, { status: 404, headers: CORS });
    }
    return NextResponse.json({ ok: true, result }, { headers: CORS });
  }

  if (echoNodeId) {
    if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
      return NextResponse.json({ ok: false, reason: "Relay authorization failed." }, { status: 401, headers: CORS });
    }
    const pending = await listPendingSurveyRelayPairRequests(echoNodeId);
    return NextResponse.json({ ok: true, pending, storage: surveyRelayStorageMode() }, { headers: CORS });
  }

  return NextResponse.json(
    { ok: false, reason: "requestId (Mirage poll) or echoNodeId (Echo poll) is required." },
    { status: 400, headers: CORS },
  );
}

type PairResponseBody = {
  requestId?: string;
  echoNodeId?: string;
  ok?: boolean;
  role?: "mirage" | "powerfist";
  echoHost?: string;
  httpPort?: number;
  token?: string;
  nodeId?: string;
  deviceId?: string;
  sessionEpoch?: number;
  reason?: string;
};

/** Echo posts pair result after completing a pending relay request locally. */
export async function PUT(request: Request) {
  if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, reason: "Relay authorization failed." }, { status: 401, headers: CORS });
  }

  let body: PairResponseBody;
  try {
    body = (await request.json()) as PairResponseBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400, headers: CORS });
  }

  const requestId = body.requestId?.trim();
  const echoNodeId = body.echoNodeId?.trim();
  if (!requestId || !echoNodeId) {
    return NextResponse.json(
      { ok: false, reason: "requestId and echoNodeId are required." },
      { status: 400, headers: CORS },
    );
  }

  await saveSurveyRelayPairResult(
    {
      requestId,
      ok: body.ok === true,
      role: body.role,
      echoNodeId: body.echoNodeId,
      echoHost: body.echoHost,
      httpPort: body.httpPort,
      token: body.token,
      nodeId: body.nodeId,
      deviceId: body.deviceId,
      sessionEpoch: body.sessionEpoch,
      reason: body.reason,
      completedAt: new Date().toISOString(),
    },
    echoNodeId,
  );

  return NextResponse.json({ ok: true }, { headers: CORS });
}
