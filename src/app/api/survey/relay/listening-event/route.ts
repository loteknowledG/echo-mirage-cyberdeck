import { NextResponse } from "next/server";
import {
  saveSurveyRelayListeningSnapshot,
  surveyRelayStorageMode,
  verifySurveyRelaySecret,
  type SurveyRelayListeningSnapshot,
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

type ListeningEventBody = {
  echoNodeId?: string;
  kind?: SurveyRelayListeningSnapshot["kind"];
  listening?: boolean;
  interim?: string;
  final?: string;
  text?: string;
  seq?: number;
  error?: string | null;
  finals?: Array<{ text: string; at: string; seq: number }>;
  level?: number;
  bands?: number[];
};

/** Echo pushes live STT / listening snapshot (HTTPS out). */
export async function POST(request: Request) {
  if (!verifySurveyRelaySecret(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, reason: "Relay authorization failed." }, { status: 401, headers: CORS });
  }

  let body: ListeningEventBody;
  try {
    body = (await request.json()) as ListeningEventBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400, headers: CORS });
  }

  const echoNodeId = body.echoNodeId?.trim();
  const kind = body.kind;
  if (!echoNodeId || !kind) {
    return NextResponse.json(
      { ok: false, reason: "echoNodeId and kind are required." },
      { status: 400, headers: CORS },
    );
  }

  const snapshot = await saveSurveyRelayListeningSnapshot({
    echoNodeId,
    kind,
    listening: body.listening,
    interim: body.interim,
    final: body.final,
    text: body.text,
    seq: body.seq,
    error: body.error,
    finals: body.finals,
    level: body.level,
    bands: body.bands,
  });

  return NextResponse.json(
    {
      ok: true,
      storage: surveyRelayStorageMode(),
      echoNodeId: snapshot.echoNodeId,
      seq: snapshot.seq,
      expiresAt: snapshot.expiresAt,
    },
    { headers: CORS },
  );
}
