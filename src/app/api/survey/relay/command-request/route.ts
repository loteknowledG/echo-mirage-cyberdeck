import { NextResponse } from "next/server";
import {
  createSurveyRelayCommandRequest,
  loadSurveyRelayCommandRequest,
  loadSurveyRelayCommandResult,
  listPendingSurveyRelayCommandRequests,
  saveSurveyRelayCommandResult,
  surveyRelayStorageMode,
  verifySurveyRelaySecret,
} from "@/lib/server/survey-cloud-relay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type CommandRequestBody = {
  echoNodeId?: string;
  action?: string;
  tabId?: number;
  payload?: {
    prompt?: string;
    pngBase64?: string;
    pngBase64List?: string[];
  };
  nodeId?: string;
};

/** Mirage enqueues an Echo command via cloud/Go relay (no direct Echo HTTP). */
export async function POST(request: Request) {
  try {
    let body: CommandRequestBody;
    try {
      body = (await request.json()) as CommandRequestBody;
    } catch {
      return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400, headers: CORS });
    }

    const echoNodeId = body.echoNodeId?.trim();
    const action = body.action?.trim();
    if (!echoNodeId || !action) {
      return NextResponse.json(
        { ok: false, reason: "echoNodeId and action are required." },
        { status: 400, headers: CORS },
      );
    }

    const commandRequest = await createSurveyRelayCommandRequest({
      echoNodeId,
      action,
      tabId: body.tabId,
      payload: body.payload,
      nodeId: body.nodeId,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: commandRequest.requestId,
        storage: surveyRelayStorageMode(),
      },
      { headers: CORS },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Command request failed.";
    return NextResponse.json({ ok: false, reason }, { status: 500, headers: CORS });
  }
}

/** Poll command result (Mirage) or list pending commands (Echo with auth). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId")?.trim();
  const echoNodeId = searchParams.get("echoNodeId")?.trim();

  if (requestId) {
    const result = await loadSurveyRelayCommandResult(requestId);
    if (!result) {
      const pending = await loadSurveyRelayCommandRequest(requestId);
      if (pending?.status === "pending") {
        return NextResponse.json({ ok: true, pending: true, requestId }, { headers: CORS });
      }
      return NextResponse.json(
        { ok: false, reason: "Command request not found or expired." },
        { status: 404, headers: CORS },
      );
    }
    return NextResponse.json({ ok: true, result }, { headers: CORS });
  }

  if (echoNodeId) {
    if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
      return NextResponse.json(
        { ok: false, reason: "Relay authorization failed." },
        { status: 401, headers: CORS },
      );
    }
    const pending = await listPendingSurveyRelayCommandRequests(echoNodeId);
    return NextResponse.json(
      { ok: true, pending, storage: surveyRelayStorageMode() },
      { headers: CORS },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      reason: "requestId (Mirage poll) or echoNodeId (Echo poll) is required.",
    },
    { status: 400, headers: CORS },
  );
}

type CommandResponseBody = {
  requestId?: string;
  echoNodeId?: string;
  ok?: boolean;
  action?: string;
  message?: string;
  reason?: string;
  answerText?: string;
  provider?: string;
  model?: string;
  pngBase64?: string;
  clipboard?: { text?: string; hasImage?: boolean; formats?: string[] };
  width?: number;
  height?: number;
};

/** Echo posts command result (screenshot PNG, clipboard, etc.) after local execute. */
export async function PUT(request: Request) {
  if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, reason: "Relay authorization failed." },
      { status: 401, headers: CORS },
    );
  }

  let body: CommandResponseBody;
  try {
    body = (await request.json()) as CommandResponseBody;
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

  await saveSurveyRelayCommandResult(
    {
      requestId,
      ok: body.ok === true,
      action: body.action,
      message: body.message,
      reason: body.reason,
      answerText: body.answerText,
      provider: body.provider,
      model: body.model,
      pngBase64: body.pngBase64,
      clipboard: body.clipboard,
      width: body.width,
      height: body.height,
      completedAt: new Date().toISOString(),
    },
    echoNodeId,
  );

  return NextResponse.json({ ok: true }, { headers: CORS });
}
