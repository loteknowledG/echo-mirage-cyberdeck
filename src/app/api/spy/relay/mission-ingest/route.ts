import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelayBody = {
  ingestUrl?: string;
  missionId?: string;
  kind?: string;
  missionSecret?: string;
  prompt?: string;
  pngBase64?: string;
};

/** Echo localhost — forward captured PNG to Mirage ingest without browser CORS. */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, reason: "Echo relay is localhost-only." }, { status: 403 });
  }

  let body: RelayBody;
  try {
    body = (await request.json()) as RelayBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const ingestUrl = body.ingestUrl?.trim();
  if (!ingestUrl?.startsWith("http://") && !ingestUrl?.startsWith("https://")) {
    return NextResponse.json({ ok: false, reason: "ingestUrl is required." }, { status: 400 });
  }

  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: body.missionId,
        kind: body.kind,
        missionSecret: body.missionSecret,
        prompt: body.prompt,
        pngBase64: body.pngBase64,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await res.json()) as Record<string, unknown>;
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "Mirage ingest relay failed." }, { status: 502 });
  }
}
