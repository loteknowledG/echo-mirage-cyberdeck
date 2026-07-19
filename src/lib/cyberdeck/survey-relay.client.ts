"use client";

import { getOrCreatePowerfistDeviceId } from "@/lib/cyberdeck/survey-pairing-client";
import { getOrCreateSurveyNodeId } from "@/lib/cyberdeck/survey-mode";
import {
  resolveSurveyHubTeamId,
  saveSurveyHubTeamId,
} from "@/lib/cyberdeck/survey-hub-store.client";
import {
  readSurveyMiragePairCredentials,
  saveSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  saveSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pair-credentials.client";
import { surveyRelayPath } from "@/lib/cyberdeck/survey-relay-base";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";
import type { SurveyRelayBundleClient } from "@/lib/cyberdeck/survey-relay-types";

/** Fired when Mirage learns / corrects the live Echo team id from the cloud relay. */
export const SURVEY_RELAY_ECHO_CHANGED_EVENT = "echo-mirage-survey-relay-echo-changed";

function rememberSurveyRelayEchoNodeId(echoNodeId: string): void {
  const id = echoNodeId.trim();
  if (!id) return;
  const previous = resolveSurveyHubTeamId();
  saveSurveyHubTeamId(id);

  const mirage = readSurveyMiragePairCredentials();
  if (mirage && mirage.echoNodeId !== id) {
    saveSurveyMiragePairCredentials({ ...mirage, echoNodeId: id });
  }
  const powerfist = readSurveyPowerfistPairCredentials();
  if (powerfist && powerfist.echoNodeId !== id) {
    saveSurveyPowerfistPairCredentials({ ...powerfist, echoNodeId: id });
  }

  if (typeof window !== "undefined" && previous !== id) {
    window.dispatchEvent(
      new CustomEvent(SURVEY_RELAY_ECHO_CHANGED_EVENT, { detail: { echoNodeId: id } }),
    );
  }
}

export async function fetchSurveyRelayBundle(
  echoNodeId: string,
): Promise<
  | { ok: true; bundle: SurveyRelayBundleClient; source: "preferred" | "active" }
  | { ok: false; reason: string }
> {
  const id = echoNodeId.trim();
  // Empty id → pull the most recently pushed Echo (no manual team id).
  if (!id) {
    return fetchActiveSurveyRelayBundle();
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
      | {
          ok: true;
          bundle: SurveyRelayBundleClient;
          source?: "preferred" | "active";
        }
      | { ok: false; reason?: string };
    if (!payload.ok) {
      return { ok: false, reason: payload.reason ?? "Relay bundle not available." };
    }
    const source = payload.source === "active" ? "active" : "preferred";
    rememberSurveyRelayEchoNodeId(payload.bundle.echoNodeId);
    return { ok: true, bundle: payload.bundle, source };
  } catch {
    return { ok: false, reason: "Could not reach cloud relay." };
  }
}

/** Pull the Echo Satellite that most recently pushed a relay bundle. */
export async function fetchActiveSurveyRelayBundle(): Promise<
  | { ok: true; bundle: SurveyRelayBundleClient; source: "preferred" | "active" }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch(surveyRelayPath("/api/survey/relay/bundle?active=1"), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await res.json()) as
      | {
          ok: true;
          bundle: SurveyRelayBundleClient;
          source?: "preferred" | "active";
        }
      | { ok: false; reason?: string };
    if (!payload.ok) {
      return {
        ok: false,
        reason:
          payload.reason ??
          "No live Echo yet — open Echo Satellite on the Mac (Screen Recording on). It pushes to the relay automatically.",
      };
    }
    rememberSurveyRelayEchoNodeId(payload.bundle.echoNodeId);
    return {
      ok: true,
      bundle: payload.bundle,
      source: payload.source === "preferred" ? "preferred" : "active",
    };
  } catch {
    return { ok: false, reason: "Could not reach cloud relay." };
  }
}

export type SurveyRelayListeningClient = {
  echoNodeId: string;
  listening: boolean;
  kind: "started" | "stopped" | "partial" | "final" | "error";
  interim: string;
  lastFinal: string;
  finals: Array<{ text: string; at: string; seq: number }>;
  seq: number;
  error: string | null;
  updatedAt: string;
  expiresAt: string;
  level?: number;
  bands?: number[];
};

/** Mirage polls latest Echo listening / STT snapshot from the cloud relay. */
export async function fetchSurveyRelayListening(
  echoNodeId?: string | null,
): Promise<
  | { ok: true; listening: SurveyRelayListeningClient; source: "preferred" | "active" }
  | { ok: false; reason: string }
> {
  const id = echoNodeId?.trim() || "";
  const path = id
    ? surveyRelayPath(`/api/survey/relay/listening?echoNodeId=${encodeURIComponent(id)}`)
    : surveyRelayPath("/api/survey/relay/listening?active=1");
  try {
    const res = await fetch(path, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await res.json()) as
      | {
          ok: true;
          listening: SurveyRelayListeningClient;
          source?: "preferred" | "active";
        }
      | { ok: false; reason?: string };
    if (!payload.ok) {
      return { ok: false, reason: payload.reason ?? "Listening snapshot not available." };
    }
    rememberSurveyRelayEchoNodeId(payload.listening.echoNodeId);
    return {
      ok: true,
      listening: payload.listening,
      source: payload.source === "active" ? "active" : "preferred",
    };
  } catch {
    return { ok: false, reason: "Could not reach cloud relay for listening state." };
  }
}

/** Resolve live Echo team id — auto-discovers; no manual team id required. */
export async function ensureSurveyRelayEchoNodeId(
  preferred?: string | null,
): Promise<{ ok: true; echoNodeId: string; source: "preferred" | "active" } | { ok: false; reason: string }> {
  const preferredId = preferred?.trim() || "";
  if (preferredId) {
    const result = await fetchSurveyRelayBundle(preferredId);
    if (result.ok) {
      return {
        ok: true,
        echoNodeId: result.bundle.echoNodeId,
        source: result.source,
      };
    }
    if (result.reason === "Could not reach cloud relay.") {
      return result;
    }
  }

  const active = await fetchActiveSurveyRelayBundle();
  if (!active.ok) return active;
  return {
    ok: true,
    echoNodeId: active.bundle.echoNodeId,
    source: active.source,
  };
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
  answerText?: string;
  provider?: string;
  model?: string;
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
  payload?: {
    prompt?: string;
    pngBase64?: string;
    pngBase64List?: string[];
  };
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
        payload: input.payload,
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
          answerText: result.answerText,
          provider: result.provider,
          model: result.model,
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
