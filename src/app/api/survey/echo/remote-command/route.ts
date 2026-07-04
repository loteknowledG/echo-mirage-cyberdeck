import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy Echo Deck commands from Mirage cyberdeck → Echo Satellite HTTP. */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const echoHost = searchParams.get("echoHost")?.trim();
  const echoHttpPort = Number(searchParams.get("echoHttpPort") || 3050);

  if (!echoHost || !Number.isFinite(echoHttpPort) || echoHttpPort <= 0) {
    return NextResponse.json(
      { ok: false, reason: "echoHost and echoHttpPort are required." },
      { status: 400 },
    );
  }

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action?.trim();
  if (!action) {
    return NextResponse.json({ ok: false, reason: "action is required." }, { status: 400 });
  }

  try {
    const res = await fetch(`http://${echoHost}:${echoHttpPort}/api/survey/echo/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });
    const payload = (await res.json()) as Record<string, unknown>;
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, reason: `Could not reach Echo Satellite at ${echoHost}:${echoHttpPort}.` },
      { status: 502 },
    );
  }
}
