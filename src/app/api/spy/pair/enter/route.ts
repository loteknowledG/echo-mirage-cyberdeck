import { NextResponse } from "next/server";
import { discoverEchoHosts } from "@/lib/server/spy-echo-discovery.server";
import {
  completeSpyPairEnter,
  completeSpyPairEnterByPin,
  parseSpyPairCode,
} from "@/lib/server/spy-echo-pairing.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnterBody = {
  code?: string;
  pin?: string;
  echoHost?: string;
  echoHttpPort?: number;
  hintHosts?: string[];
  pairId?: string;
  pairSecret?: string;
  role?: "mirage" | "powerfist";
  nodeId?: string;
  deviceId?: string;
};

type PairEnterPayload =
  | {
      ok: true;
      role: "mirage" | "powerfist";
      echoNodeId: string;
      echoHost: string;
      httpPort: number;
      token: string;
      nodeId?: string;
      deviceId?: string;
      sessionEpoch: number;
    }
  | { ok: false; reason: string };

function requestHost(request: Request): string {
  return (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
}

function shouldHandlePinLocally(echoHost: string | undefined, request: Request): boolean {
  const host = echoHost?.trim().toLowerCase();
  if (!host || host === "127.0.0.1" || host === "localhost") {
    return true;
  }
  return requestHost(request) === host;
}

async function forwardPinToEcho(input: {
  echoHost: string;
  echoHttpPort: number;
  pin: string;
  role: "mirage" | "powerfist";
  nodeId?: string;
  deviceId?: string;
}): Promise<PairEnterPayload> {
  try {
    const forwardUrl = `http://${input.echoHost}:${input.echoHttpPort}/api/spy/pair/enter`;
    const forwardRes = await fetch(forwardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: input.pin,
        role: input.role,
        nodeId: input.nodeId,
        deviceId: input.deviceId,
      }),
    });
    return (await forwardRes.json()) as PairEnterPayload;
  } catch {
    return {
      ok: false,
      reason: `Could not reach Echo at ${input.echoHost}:${input.echoHttpPort}.`,
    };
  }
}

async function pairPinWithDiscovery(input: {
  echoHttpPort: number;
  pin: string;
  role: "mirage" | "powerfist";
  nodeId?: string;
  deviceId?: string;
  hintHosts?: string[];
}): Promise<PairEnterPayload> {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const host of input.hintHosts ?? []) {
    const trimmed = host.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    candidates.push(trimmed);
  }

  const discovered = await discoverEchoHosts(input.echoHttpPort);
  for (const host of discovered) {
    if (seen.has(host)) continue;
    seen.add(host);
    candidates.push(host);
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason:
        "Could not find Echo on your LAN. Open Echo Satellite on the screenshot Mac (same Wi‑Fi), or enter its IP under Advanced.",
    };
  }

  let invalidPin = false;
  let lastReason = "Could not pair with Echo.";

  for (const echoHost of candidates) {
    const result = await forwardPinToEcho({
      echoHost,
      echoHttpPort: input.echoHttpPort,
      pin: input.pin,
      role: input.role,
      nodeId: input.nodeId,
      deviceId: input.deviceId,
    });

    if (result.ok) {
      return result;
    }

    lastReason = result.reason;
    if (result.reason.toLowerCase().includes("invalid pairing code")) {
      invalidPin = true;
      break;
    }
  }

  if (invalidPin) {
    return { ok: false, reason: "Invalid pairing code." };
  }

  return { ok: false, reason: lastReason };
}

/** Mirage or PowerFist — enter the pairing code shown on Echo. */
export async function POST(request: Request) {
  let body: EnterBody;
  try {
    body = (await request.json()) as EnterBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const pin = body.pin?.trim();
  const role = body.role;
  if (pin && role) {
    const echoHttpPort = Number(body.echoHttpPort) || 3050;
    const echoHost = body.echoHost?.trim();

    if (!echoHost) {
      if (shouldHandlePinLocally(undefined, request)) {
        const result = await completeSpyPairEnterByPin({
          pin,
          role,
          nodeId: body.nodeId,
          deviceId: body.deviceId,
        });
        return NextResponse.json(result, { status: result.ok ? 200 : 403 });
      }

      const result = await pairPinWithDiscovery({
        echoHttpPort,
        pin,
        role,
        nodeId: body.nodeId,
        deviceId: body.deviceId,
        hintHosts: body.hintHosts,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "Invalid pairing code." ? 403 : 502 });
    }

    if (!shouldHandlePinLocally(echoHost, request)) {
      const result = await forwardPinToEcho({
        echoHost,
        echoHttpPort,
        pin,
        role,
        nodeId: body.nodeId,
        deviceId: body.deviceId,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    const result = await completeSpyPairEnterByPin({
      pin,
      role,
      nodeId: body.nodeId,
      deviceId: body.deviceId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
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

  const pairId = body.pairId?.trim();
  const pairSecret = body.pairSecret?.trim();
  if (!role || !pairId || !pairSecret) {
    return NextResponse.json(
      { ok: false, reason: "pin/role or code or pairId/pairSecret/role required." },
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
