import { discoverEchoEndpointsOnLan } from "@/lib/cyberdeck/survey-echo-discovery.client";
import { getOrCreateSurveyNodeId } from "@/lib/cyberdeck/survey-mode";
import { parseEchoEndpointInput } from "@/lib/cyberdeck/survey-pair-pin";
import { getOrCreatePowerfistDeviceId } from "@/lib/cyberdeck/survey-pair-credentials.client";
import {
  isHttpsBrowserClient,
  isPwaPairReachabilityError,
  isSurveyHttpsPairBlocked,
  LEGACY_SPY_PAIR_ENTER_PATH,
  SURVEY_PWA_PAIR_BLOCKED_MESSAGE,
} from "@/lib/cyberdeck/survey-pairing-shared.client";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";

export type SurveyPairSuccess = {
  ok: true;
  role: "mirage" | "powerfist";
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  token: string;
  nodeId?: string;
  deviceId?: string;
  sessionEpoch: number;
};

export type SurveyPairResult = SurveyPairSuccess | { ok: false; reason: string };

export async function enterSurveyPairPin(input: {
  echoHost?: string;
  echoHttpPort: number;
  echoNodeId?: string;
  pin: string;
  role: "mirage" | "powerfist";
  hintHosts?: string[];
}): Promise<SurveyPairResult> {
  const nodeId = getOrCreateSurveyNodeId();
  const deviceId = getOrCreatePowerfistDeviceId();
  const resolvedEndpoint = input.echoHost
    ? parseEchoEndpointInput(input.echoHost, input.echoHttpPort)
    : { host: "", port: input.echoHttpPort };
  const body = {
    pin: input.pin,
    role: input.role,
    nodeId,
    deviceId,
  };

  async function postViaCyberdeckProxy(
    host: string,
    port: number,
  ): Promise<SurveyPairResult> {
    traceSurveyPairing(`pair POST /api/survey/pair/enter proxy → ${host}:${port} role=${input.role}`);
    try {
      const res = await fetch("/api/survey/pair/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          echoHost: host,
          echoHttpPort: port,
          pin: input.pin,
          role: input.role,
          nodeId,
          deviceId,
          hintHosts: input.hintHosts,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(35_000),
      });
      const serverResult = (await res.json()) as SurveyPairResult;
      if (serverResult.ok) {
        traceSurveyPairing(`pair OK via cyberdeck proxy · ${serverResult.echoHost}:${serverResult.httpPort}`);
        return serverResult;
      }
      traceSurveyPairing(`pair proxy fail — ${serverResult.reason}`);
      if (isHttpsBrowserClient() && isPwaPairReachabilityError(serverResult.reason)) {
        return { ok: false, reason: SURVEY_PWA_PAIR_BLOCKED_MESSAGE };
      }
      return serverResult;
    } catch {
      return {
        ok: false,
        reason: isHttpsBrowserClient() ? SURVEY_PWA_PAIR_BLOCKED_MESSAGE : "Pair request failed.",
      };
    }
  }

  async function postDirect(host: string, port: number): Promise<SurveyPairResult> {
    if (!host.trim()) {
      return { ok: false, reason: "Enter Echo Satellite IP address." };
    }

    async function postPairEnter(path: string): Promise<{
      ok: boolean;
      status: number;
      payload?: SurveyPairResult;
      reason?: string;
    }> {
      traceSurveyPairing(`pair POST http://${host}:${port}${path} role=${input.role}`);
      try {
        const res = await fetch(`http://${host}:${port}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          mode: "cors",
          signal: AbortSignal.timeout(8_000),
        });
        const text = await res.text();
        try {
          const payload = JSON.parse(text) as SurveyPairResult;
          return { ok: payload.ok === true, status: res.status, payload };
        } catch {
          return {
            ok: false,
            status: res.status,
            reason: `Echo at ${host}:${port} returned an unexpected response (HTTP ${res.status}).`,
          };
        }
      } catch (error) {
        const detail =
          error instanceof Error && error.name === "TimeoutError"
            ? "Timed out — check Echo Satellite is running and Screen Recording is granted."
            : "";
        return {
          ok: false,
          status: 0,
          reason: [`Could not reach Echo at ${host}:${port}.`, detail].filter(Boolean).join(" "),
        };
      }
    }

    let result = await postPairEnter("/api/survey/pair/enter");
    if (!result.ok && result.status === 404) {
      traceSurveyPairing(`pair route fallback → legacy ${LEGACY_SPY_PAIR_ENTER_PATH}`);
      result = await postPairEnter(LEGACY_SPY_PAIR_ENTER_PATH);
    }

    if (result.reason) {
      if (isHttpsBrowserClient()) {
        return { ok: false, reason: SURVEY_PWA_PAIR_BLOCKED_MESSAGE };
      }
      return { ok: false, reason: result.reason };
    }

    const payload = result.payload;
    if (!payload) {
      return { ok: false, reason: `Could not reach Echo at ${host}:${port}.` };
    }

    if (payload.ok) {
      traceSurveyPairing(
        `pair OK via ${host}:${port} · echoNode ${payload.echoNodeId.slice(0, 8)}… · epoch ${payload.sessionEpoch}`,
      );
      return {
        ...payload,
        echoHost: payload.echoHost || host,
        httpPort: payload.httpPort || port,
      };
    }

    traceSurveyPairing(`pair rejected ${host}:${port} — ${payload.reason}`);
    return payload;
  }

  traceSurveyPairing(
    `pair start role=${input.role} node=${nodeId.slice(0, 8)}… host=${resolvedEndpoint.host || "LAN discovery"} port=${resolvedEndpoint.port}`,
  );

  if (isSurveyHttpsPairBlocked()) {
    traceSurveyPairing("pair route: cloud relay (HTTPS shell)");
    const echoNodeId = input.echoNodeId?.trim();
    if (!echoNodeId) {
      return {
        ok: false,
        reason:
          "Enter Echo team ID from Echo Satellite (cloud relay). IP/port are not required in the PWA.",
      };
    }
    const { enterSurveyPairPinViaRelay } = await import("@/lib/cyberdeck/survey-relay.client");
    return enterSurveyPairPinViaRelay({
      echoNodeId,
      pin: input.pin,
      role: input.role,
    });
  }

  if (typeof window !== "undefined") {
    if (resolvedEndpoint.host) {
      if (isHttpsBrowserClient()) {
        traceSurveyPairing(
          `pair route: HTTPS cyberdeck proxy → ${resolvedEndpoint.host}:${resolvedEndpoint.port}`,
        );
        return postViaCyberdeckProxy(resolvedEndpoint.host, resolvedEndpoint.port);
      }
      traceSurveyPairing(`pair route: direct to ${resolvedEndpoint.host}:${resolvedEndpoint.port}`);
      return postDirect(resolvedEndpoint.host, resolvedEndpoint.port);
    }

    traceSurveyPairing("pair route: try cyberdeck /api/survey/pair/enter proxy");
    try {
      const res = await fetch("/api/survey/pair/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          echoHttpPort: input.echoHttpPort,
          hintHosts: input.hintHosts,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(35_000),
      });
      const serverResult = (await res.json()) as SurveyPairResult;
      if (serverResult.ok) {
        traceSurveyPairing(`pair OK via cyberdeck proxy · ${serverResult.echoHost}:${serverResult.httpPort}`);
        return serverResult;
      }
      traceSurveyPairing(`pair proxy fail — ${serverResult.reason}`);
      const reason = serverResult.reason?.toLowerCase() ?? "";
      if (reason.includes("invalid pairing code") || reason.includes("expired")) {
        return serverResult;
      }
    } catch {
      traceSurveyPairing("pair proxy unreachable — falling back to browser LAN discovery");
    }

    traceSurveyPairing("pair route: browser LAN discovery");
    const endpoints = await discoverEchoEndpointsOnLan(input.hintHosts ?? []);
    traceSurveyPairing(`LAN discovery found ${endpoints.length} Echo endpoint(s)`);

    if (endpoints.length === 0) {
      return {
        ok: false,
        reason:
          "Could not reach Echo. Open Echo Satellite on the screenshot Mac and enter its IP and port.",
      };
    }
    let invalidPin = false;
    let lastReason = "Could not pair with Echo.";

    for (const endpoint of endpoints) {
      const result = await postDirect(endpoint.host, endpoint.port);
      if (result.ok) return result;
      lastReason = result.reason;
      if (result.reason.toLowerCase().includes("invalid pairing code")) {
        invalidPin = true;
        break;
      }
    }

    return { ok: false, reason: invalidPin ? "Invalid pairing code." : lastReason };
  }

  try {
    const res = await fetch("/api/survey/pair/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        echoHost: input.echoHost,
        echoHttpPort: input.echoHttpPort,
        hintHosts: input.hintHosts,
        pin: input.pin,
        role: input.role,
        nodeId,
        deviceId,
      }),
    });
    return (await res.json()) as SurveyPairResult;
  } catch {
    return { ok: false, reason: "Pair request failed." };
  }
}

/** @deprecated Legacy long-code pairing — use enterSurveyPairPin instead. */
export async function enterSurveyPairCode(code: string): Promise<SurveyPairResult> {
  const nodeId = getOrCreateSurveyNodeId();
  const deviceId = getOrCreatePowerfistDeviceId();

  try {
    const res = await fetch("/api/survey/pair/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, nodeId, deviceId }),
    });
    return (await res.json()) as SurveyPairResult;
  } catch {
    return { ok: false, reason: "Pair request failed." };
  }
}
