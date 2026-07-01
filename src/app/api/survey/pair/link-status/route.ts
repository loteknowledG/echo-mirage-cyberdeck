import { NextResponse } from "next/server";
import { checkEchoSurveyLinkStatus } from "@/lib/server/survey-echo-pairing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkStatusBody = {
  echoNodeId?: string;
  role?: "mirage" | "powerfist";
  sessionEpoch?: number;
  nodeId?: string;
  deviceId?: string;
};

/** Mirage or PowerFist — poll whether Echo Survey session is still active. */
export async function POST(request: Request) {
  let body: LinkStatusBody;
  try {
    body = (await request.json()) as LinkStatusBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const echoNodeId = body.echoNodeId?.trim();
  const role = body.role;
  if (!echoNodeId || (role !== "mirage" && role !== "powerfist")) {
    return NextResponse.json(
      { ok: false, reason: "echoNodeId and role (mirage|powerfist) required." },
      { status: 400 },
    );
  }

  const result = await checkEchoSurveyLinkStatus({
    echoNodeId,
    role,
    sessionEpoch: body.sessionEpoch ?? 0,
    nodeId: body.nodeId,
    deviceId: body.deviceId,
  });

  return NextResponse.json(result);
}
