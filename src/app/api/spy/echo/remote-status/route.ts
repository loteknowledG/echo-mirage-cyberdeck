import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy Echo Satellite pairing status from Mirage (Echo codes API is localhost-only on cyberdeck). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const echoHost = searchParams.get("echoHost")?.trim();
  const echoHttpPort = Number(searchParams.get("echoHttpPort") || 3050);

  if (!echoHost || !Number.isFinite(echoHttpPort) || echoHttpPort <= 0) {
    return NextResponse.json(
      { ok: false, reason: "echoHost and echoHttpPort are required." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`http://${echoHost}:${echoHttpPort}/api/spy/echo/codes`, {
      cache: "no-store",
    });
    const payload = (await res.json()) as { ok?: boolean; reason?: string };
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, reason: `Could not reach Echo at ${echoHost}:${echoHttpPort}.` },
      { status: 502 },
    );
  }
}
