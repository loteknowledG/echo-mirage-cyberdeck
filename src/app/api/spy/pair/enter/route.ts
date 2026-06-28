import { NextResponse } from "next/server";
import {
  completeSpyPairEnter,
  parseSpyPairCode,
} from "@/lib/server/spy-echo-pairing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnterBody = {
  code?: string;
  pairId?: string;
  pairSecret?: string;
  role?: "mirage" | "powerfist";
  nodeId?: string;
  deviceId?: string;
};

/** Mirage or PowerFist — enter the pairing code shown on Echo. */
export async function POST(request: Request) {
  let body: EnterBody;
  try {
    body = (await request.json()) as EnterBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const code = body.code?.trim();
  if (code) {
    const parsed = parseSpyPairCode(code);
    if (!parsed) {
      return NextResponse.json({ ok: false, reason: "Could not parse pairing code." }, { status: 400 });
    }

    const isLocalEcho =
      parsed.host === "127.0.0.1" ||
      parsed.host === "localhost" ||
      request.headers.get("host")?.startsWith(`${parsed.host}:`);

    if (!isLocalEcho) {
      try {
        const forwardUrl = `http://${parsed.host}:${parsed.httpPort}/api/spy/pair/enter`;
        const forwardRes = await fetch(forwardUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pairId: parsed.pairId,
            pairSecret: parsed.pairSecret,
            role: parsed.role,
            nodeId: body.nodeId,
            deviceId: body.deviceId,
          }),
        });
        const payload = (await forwardRes.json()) as { ok?: boolean; reason?: string };
        return NextResponse.json(payload, { status: forwardRes.status });
      } catch {
        return NextResponse.json(
          { ok: false, reason: `Could not reach Echo at ${parsed.host}:${parsed.httpPort}.` },
          { status: 502 },
        );
      }
    }

    const result = await completeSpyPairEnter({
      pairId: parsed.pairId,
      pairSecret: parsed.pairSecret,
      role: parsed.role,
      nodeId: body.nodeId,
      deviceId: body.deviceId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  }

  const role = body.role;
  const pairId = body.pairId?.trim();
  const pairSecret = body.pairSecret?.trim();
  if (!role || !pairId || !pairSecret) {
    return NextResponse.json(
      { ok: false, reason: "code or pairId/pairSecret/role required." },
      { status: 400 },
    );
  }

  const result = await completeSpyPairEnter({
    pairId,
    pairSecret,
    role,
    nodeId: body.nodeId,
    deviceId: body.deviceId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
