"use client";

import { getOrCreatePowerfistDeviceId } from "@/lib/cyberdeck/survey-pairing-client";
import { getOrCreateSurveyNodeId } from "@/lib/cyberdeck/survey-mode";
import { surveyRelayPath } from "@/lib/cyberdeck/survey-relay-base";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";
import type { SurveyRelayBundleClient } from "@/lib/cyberdeck/survey-relay-types";

export async function fetchSurveyRelayBundle(
  echoNodeId: string,
): Promise<{ ok: true; bundle: SurveyRelayBundleClient } | { ok: false; reason: string }> {
  const id = echoNodeId.trim();
  if (!id) {
    return { ok: false, reason: "Enter Echo team ID (from Echo Satellite status panel)." };
  }

  try {
    const res = await fetch(
      surveyRelayPath(`/api/survey/relay/bundle?echoNodeId=${encodeURIComponent(id)}`),
      {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const payload = (await res.json()) as
      | { ok: true; bundle: SurveyRelayBundleClient }
      | { ok: false; reason?: string };
    if (!payload.ok) {
      return { ok: false, reason: payload.reason ?? "Relay bundle not available." };
    }
    return { ok: true, bundle: payload.bundle };
  } catch {
    return { ok: false, reason: "Could not reach cloud relay." };
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function enterSurveyPairPinViaRelay(input: {
  echoNodeId: string;
  pin: string;
  role: "mirage" | "powerfist";
}): Promise<
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
  | { ok: false; reason: string }
> {
  const echoNodeId = input.echoNodeId.trim();
  const pin = input.pin.trim();
  const nodeId = getOrCreateSurveyNodeId();
  const deviceId = getOrCreatePowerfistDeviceId();

  traceSurveyPairing(`relay pair start · echo ${echoNodeId.slice(0, 8)}… · role ${input.role}`);

  let requestId: string;
  try {
    const res = await fetch(surveyRelayPath("/api/survey/relay/pair-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        echoNodeId,
        role: input.role,
        pin,
        nodeId,
        deviceId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await res.json()) as { ok: boolean; requestId?: string; reason?: string };
    if (!payload.ok || !payload.requestId) {
      return { ok: false, reason: payload.reason ?? "Relay pair request failed." };
    }
    requestId = payload.requestId;
  } catch {
    return { ok: false, reason: "Could not submit pair request to cloud relay." };
  }

  traceSurveyPairing(`relay pair waiting · request ${requestId.slice(0, 8)}…`);

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        surveyRelayPath(`/api/survey/relay/pair-request?requestId=${encodeURIComponent(requestId)}`),
        { cache: "no-store", signal: AbortSignal.timeout(12_000) },
      );
      const payload = (await res.json()) as
        | { ok: true; pending: true }
        | {
            ok: true;
            result: {
              ok: boolean;
              role?: "mirage" | "powerfist";
              echoNodeId?: string;
              echoHost?: string;
              httpPort?: number;
              token?: string;
              nodeId?: string;
              deviceId?: string;
              sessionEpoch?: number;
              reason?: string;
            };
          }
        | { ok: false; reason?: string };

      if (!payload.ok) {
        return { ok: false, reason: payload.reason ?? "Relay pair poll failed." };
      }

      if ("pending" in payload && payload.pending) {
        await sleep(1500);
        continue;
      }

      if ("result" in payload) {
        const result = payload.result;
        if (!result.ok) {
          return { ok: false, reason: result.reason ?? "Pairing rejected by Echo." };
        }
        if (result.role !== input.role) {
          return {
            ok: false,
            reason: `That code is for ${result.role === "mirage" ? "Mirage" : "PowerFist"}, not ${input.role}.`,
          };
        }
        traceSurveyPairing(`relay pair OK · ${result.echoHost}:${result.httpPort}`);
        return {
          ok: true,
          role: input.role,
          echoNodeId: result.echoNodeId ?? echoNodeId,
          echoHost: result.echoHost ?? "relay",
          httpPort: result.httpPort ?? 3050,
          token: result.token ?? "",
          nodeId: result.nodeId,
          deviceId: result.deviceId,
          sessionEpoch: result.sessionEpoch ?? 1,
        };
      }
    } catch {
      /* retry until deadline */
    }
    await sleep(1500);
  }

  return {
    ok: false,
    reason:
      "Echo did not answer the relay pair request in time. On Echo Mac, open Echo Satellite and ensure it can reach the cyberdeck URL.",
  };
}

export type SurveyRelayCommandClientResult = {
  ok: boolean;
  message?: string;
  reason?: string;
  action?: string;
  pngBase64?: string;
  clipboard?: { text?: string; hasImage?: boolean; formats?: string[] };
  width?: number;
  height?: number;
};

/**
 * Enqueue an Echo Satellite command via HTTPS middlebox (Next or Go relay).
 * Echo polls, executes locally (Screen Recording stays on Mac), then PUTs the result.
 */
export async function sendSurveyEchoCommandViaRelay(input: {
  echoNodeId: string;
  action: string;
  tabId?: number;
}): Promise<SurveyRelayCommandClientResult> {
  const echoNodeId = input.echoNodeId.trim();
  const action = input.action.trim();
  if (!echoNodeId || !action) {
    return { ok: false, reason: "echoNodeId and action are required for relay command." };
  }

  const nodeId = getOrCreateSurveyNodeId();
  let requestId: string;
  try {
    const res = await fetch(surveyRelayPath("/api/survey/relay/command-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        echoNodeId,
        action,
        tabId: input.tabId,
        nodeId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await res.json()) as { ok: boolean; requestId?: string; reason?: string };
    if (!payload.ok || !payload.requestId) {
      return { ok: false, reason: payload.reason ?? "Relay command request failed." };
    }
    requestId = payload.requestId;
  } catch {
    return { ok: false, reason: "Could not submit command to cloud relay." };
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        surveyRelayPath(
          `/api/survey/relay/command-request?requestId=${encodeURIComponent(requestId)}`,
        ),
        { cache: "no-store", signal: AbortSignal.timeout(20_000) },
      );
      const payload = (await res.json()) as
        | { ok: true; pending: true }
        | { ok: true; result: SurveyRelayCommandClientResult }
        | { ok: false; reason?: string };

      if (!payload.ok) {
        return { ok: false, reason: payload.reason ?? "Relay command poll failed." };
      }

      if ("pending" in payload && payload.pending) {
        await sleep(1200);
        continue;
      }

      if ("result" in payload) {
        const result = payload.result;
        if (!result.ok) {
          return {
            ok: false,
            reason: result.reason ?? "Echo rejected the relay command.",
            action: result.action,
          };
        }
        return {
          ok: true,
          message: result.message ?? `${action} OK via relay`,
          action: result.action ?? action,
          pngBase64: result.pngBase64,
          clipboard: result.clipboard,
          width: result.width,
          height: result.height,
        };
      }
    } catch {
      /* retry until deadline */
    }
    await sleep(1200);
  }

  return {
    ok: false,
    reason:
      "Echo did not answer the relay command in time. Keep Echo Satellite open so it can poll the relay middlebox.",
  };
}
