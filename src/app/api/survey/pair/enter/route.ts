import { NextResponse } from "next/server";
import { discoverEchoHosts } from "@/lib/server/survey-echo-discovery.server";
import {
  completeSurveyPairEnter,
  completeSurveyPairEnterByPin,
  parseSurveyPairCode,
} from "@/lib/server/survey-echo-pairing.server";
import { parseEchoEndpointInput } from "@/lib/cyberdeck/survey-pair-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SURVEY_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SURVEY_CORS_HEADERS });
}

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
  if (!host) return false;
  if (host === "127.0.0.1" || host === "localhost") {
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
  const endpoint = parseEchoEndpointInput(input.echoHost, input.echoHttpPort);
  const body = JSON.stringify({
    pin: input.pin,
    role: input.role,
    nodeId: input.nodeId,
    deviceId: input.deviceId,
  });

  async function tryForward(path: string): Promise<{ status: number; payload: PairEnterPayload | null }> {
    const forwardUrl = `http://${endpoint.host}:${endpoint.port}${path}`;
    const forwardRes = await fetch(forwardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await forwardRes.text();
    try {
      return {
        status: forwardRes.status,
        payload: JSON.parse(text) as PairEnterPayload,
      };
    } catch {
      return { status: forwardRes.status, payload: null };
    }
  }

  try {
    let result = await tryForward("/api/survey/pair/enter");
    if ((!result.payload || !result.payload.ok) && result.status === 404) {
      result = await tryForward("/api/spy/pair/enter");
    }
    if (!result.payload) {
      return {
        ok: false,
        reason: `Could not reach Echo at ${endpoint.host}:${endpoint.port}.`,
      };
    }
    return result.payload;
  } catch {
    return {
      ok: false,
      reason: `Could not reach Echo at ${endpoint.host}:${endpoint.port}.`,
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
        "Could not reach Echo. Open Echo Satellite on the screenshot Mac and enter its IP and port.",
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
    const echoHttpPortDefault = Number(body.echoHttpPort) || 3050;
    const parsed = body.echoHost?.trim()
      ? parseEchoEndpointInput(body.echoHost, echoHttpPortDefault)
      : { host: "", port: echoHttpPortDefault };
    const echoHost = parsed.host;
    const echoHttpPort = parsed.port;

    if (!echoHost) {
      const result = await pairPinWithDiscovery({
        echoHttpPort,
        pin,
        role,
        nodeId: body.nodeId,
        deviceId: body.deviceId,
        hintHosts: body.hintHosts,
      });
      return NextResponse.json(result, {
        status: result.ok ? 200 : result.reason === "Invalid pairing code." ? 403 : 502,
        headers: SURVEY_CORS_HEADERS,
      });
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
      return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: SURVEY_CORS_HEADERS });
    }

    const result = await completeSurveyPairEnterByPin({
      pin,
      role,
      nodeId: body.nodeId,
      deviceId: body.deviceId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 403, headers: SURVEY_CORS_HEADERS });
  }

  const code = body.code?.trim();
  if (code) {
    const parsed = parseSurveyPairCode(code);
    if (!parsed) {
      return NextResponse.json({ ok: false, reason: "Could not parse pairing code." }, { status: 400 });
    }

    const isLocalEcho =
      parsed.host === "127.0.0.1" ||
      parsed.host === "localhost" ||
      request.headers.get("host")?.startsWith(`${parsed.host}:`);

    if (!isLocalEcho) {
      try {
        const forwardUrl = `http://${parsed.host}:${parsed.httpPort}/api/survey/pair/enter`;
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

    const result = await completeSurveyPairEnter({
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

  const result = await completeSurveyPairEnter({
    pairId,
    pairSecret,
    role,
    nodeId: body.nodeId,
    deviceId: body.deviceId,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
