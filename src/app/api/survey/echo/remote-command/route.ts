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

  const hostsToTry = [echoHost];
  if (echoHost !== "127.0.0.1" && echoHost !== "localhost") {
    hostsToTry.push("127.0.0.1");
  }

  let lastError = `Could not reach Echo Satellite at ${echoHost}:${echoHttpPort}.`;
  for (const host of hostsToTry) {
    try {
      const res = await fetch(`http://${host}:${echoHttpPort}/api/survey/echo/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const payload = (await res.json()) as Record<string, unknown>;
      if (res.ok && payload.ok === true) {
        return NextResponse.json(payload, { status: res.status });
      }
      lastError =
        typeof payload.reason === "string"
          ? payload.reason
          : typeof payload.error === "string"
            ? payload.error
            : `Echo command failed at ${host}:${echoHttpPort}.`;
    } catch {
      lastError = `Could not reach Echo Satellite at ${host}:${echoHttpPort}.`;
    }
  }

  return NextResponse.json({ ok: false, reason: lastError }, { status: 502 });
}
