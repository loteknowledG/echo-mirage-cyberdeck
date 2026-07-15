import { NextResponse } from "next/server";
import {
  DEFAULT_ECHO_TAILSCALE_HOST,
  isLanPrivateEchoHost,
  preferMeshEchoHost,
} from "@/lib/cyberdeck/survey-pair-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy Echo Deck commands from Mirage cyberdeck → Echo Satellite HTTP. */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const echoHostRaw = searchParams.get("echoHost")?.trim();
  const echoHttpPort = Number(searchParams.get("echoHttpPort") || 3050);

  if (!echoHostRaw || !Number.isFinite(echoHttpPort) || echoHttpPort <= 0) {
    return NextResponse.json(
      { ok: false, reason: "echoHost and echoHttpPort are required." },
      { status: 400 },
    );
  }

  let body: { action?: string; tabId?: number | string };
  try {
    body = (await request.json()) as { action?: string; tabId?: number | string };
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action?.trim();
  if (!action) {
    return NextResponse.json({ ok: false, reason: "action is required." }, { status: 400 });
  }

  const tabIdRaw = body.tabId;
  const tabId =
    typeof tabIdRaw === "number"
      ? tabIdRaw
      : typeof tabIdRaw === "string" && tabIdRaw.trim()
        ? Number(tabIdRaw)
        : undefined;

  // Remap Echo LAN ads to Tailscale; never fall back to 127.0.0.1 (that's Mirage on Windows).
  const meshHost = preferMeshEchoHost(echoHostRaw) ?? echoHostRaw;
  const hostsToTry = [meshHost];
  if (echoHostRaw !== meshHost) {
    hostsToTry.push(echoHostRaw);
  } else if (isLanPrivateEchoHost(echoHostRaw)) {
    hostsToTry.push(DEFAULT_ECHO_TAILSCALE_HOST);
  }

  const forwardBody: { action: string; tabId?: number } = { action };
  if (Number.isFinite(tabId)) {
    forwardBody.tabId = tabId;
  }

  let lastError = `Could not reach echo-electron at ${meshHost}:${echoHttpPort}.`;
  for (const host of hostsToTry) {
    try {
      const res = await fetch(`http://${host}:${echoHttpPort}/api/survey/echo/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forwardBody),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
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
      lastError = `Could not reach echo-electron at ${host}:${echoHttpPort}.`;
    }
  }

  return NextResponse.json({ ok: false, reason: lastError }, { status: 502 });
}
