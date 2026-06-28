import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";
import { ESPIONAGE_ECHO_NODE_LABEL } from "@/lib/cyberdeck/espionage-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelayBody = {
  mirageHost?: string;
  mirageHttpPort?: number;
  pairId?: string;
  pairSecret?: string;
  nodeId?: string;
};

/** Echo localhost — forward capture-deck pairing to the Mirage solver hub. */
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

  const mirageHost = body.mirageHost?.trim();
  const mirageHttpPort = body.mirageHttpPort;
  const pairId = body.pairId?.trim();
  const pairSecret = body.pairSecret?.trim();
  const nodeId = body.nodeId?.trim();

  if (!mirageHost || !pairId || !pairSecret || !nodeId) {
    return NextResponse.json(
      { ok: false, reason: "mirageHost, pairId, pairSecret, and nodeId are required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(mirageHttpPort) || !mirageHttpPort || mirageHttpPort <= 0) {
    return NextResponse.json({ ok: false, reason: "mirageHttpPort is required." }, { status: 400 });
  }

  try {
    const res = await fetch(`http://${mirageHost}:${mirageHttpPort}/api/powerfist/pair/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairId,
        pairSecret,
        nodeId,
        label: ESPIONAGE_ECHO_NODE_LABEL,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await res.json()) as Record<string, unknown>;
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "Mirage hub pair relay failed." }, { status: 502 });
  }
}
