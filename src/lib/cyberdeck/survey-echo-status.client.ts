import { ECHO_SURVEY_TERMINATED_MESSAGE } from "@/lib/cyberdeck/survey-mode";
import { parseEchoEndpointInput } from "@/lib/cyberdeck/survey-pair-pin";
import { isHttpsBrowserClient } from "@/lib/cyberdeck/survey-pairing-shared.client";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";

const LOCAL_CYBERDECK_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"];
const SATELLITE_STATUS_URL = "http://127.0.0.1:3050/spy/status";
const SATELLITE_CODES_URL = "http://127.0.0.1:3050/api/survey/echo/codes";
const LEGACY_SPY_STATUS_PATH = "/spy/status";

export type SurveyPairedMirage = {
  nodeId: string;
  pairedAt: string;
};

export function normalizePairedMirages(status: {
  pairedMirages?: SurveyPairedMirage[];
  pairedMirage?: SurveyPairedMirage | null;
}): SurveyPairedMirage[] {
  if (status.pairedMirages?.length) {
    return status.pairedMirages;
  }
  if (status.pairedMirage) {
    return [status.pairedMirage];
  }
  return [];
}

export type EchoSurveyStatusSource = "cyberdeck" | "local-cyberdeck" | "satellite";

export type EchoSurveyStatus = {
  ok: true;
  source: EchoSurveyStatusSource;
  echoNodeId?: string;
  echoHost: string;
  httpPort: number;
  miragePin: string | null;
  powerfistPin: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirages: SurveyPairedMirage[];
  pairedMirage: SurveyPairedMirage | null;
  pairedPowerfist: { deviceId: string; pairedAt: string } | null;
  armed?: boolean;
  wsStatus?: string;
  captureMirage?: { host: string; port: number } | null;
  surveyLinksReachable?: boolean;
  echoSurveyActive?: boolean;
  sessionEpoch?: number;
};

async function readEchoSurveyPayload(url: string): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      return { ok: false, reason: `Request failed (${res.status}).` };
    }
    const payload = (await res.json()) as EchoSurveyStatus | { ok: false; reason?: string };
    if (!payload.ok) {
      return { ok: false, reason: payload.reason ?? "Could not load Echo Survey status." };
    }
    const pairedMirages = normalizePairedMirages(payload);
    return {
      ...payload,
      pairedMirages,
      pairedMirage: pairedMirages[0] ?? null,
      miragePin: payload.miragePin ?? null,
      powerfistPin: payload.powerfistPin ?? null,
      mirageExpiresAt: payload.mirageExpiresAt ?? null,
      powerfistExpiresAt: payload.powerfistExpiresAt ?? null,
      pairedPowerfist: payload.pairedPowerfist ?? null,
      echoSurveyActive: payload.echoSurveyActive ?? true,
    };
  } catch {
    return { ok: false, reason: "Could not reach Echo status endpoint." };
  }
}

async function readRemoteEchoSurveyPayload(
  host: string,
  port: number,
): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  const survey = await readEchoSurveyPayload(`http://${host}:${port}/api/survey/echo/codes`);
  if (survey.ok) {
    return survey;
  }
  return readEchoSurveyPayload(`http://${host}:${port}${LEGACY_SPY_STATUS_PATH}`);
}

/** Load Echo Survey status from a known Echo Satellite on the LAN (browser → Echo direct). */
export async function fetchEchoRemoteSurveyStatusClient(
  echoHost: string,
  echoHttpPort: number,
): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  const codes = await fetchEchoRemoteSurveyCodesClient(echoHost, echoHttpPort);
  if (codes.ok) {
    return codes;
  }

  const endpoint = parseEchoEndpointInput(echoHost, echoHttpPort);
  if (!endpoint.host) {
    return { ok: false, reason: "echoHost is required." };
  }

  const status = await readRemoteEchoSurveyPayload(endpoint.host, endpoint.port);
  if (!status.ok) {
    return status;
  }
  return { ...status, source: "satellite" };
}

/** Load full Echo Survey pairing state from Echo Satellite (preferred for remote link checks). */
export async function fetchEchoRemoteSurveyCodesClient(
  echoHost: string,
  echoHttpPort: number,
): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  const endpoint = parseEchoEndpointInput(echoHost, echoHttpPort);
  if (!endpoint.host) {
    return { ok: false, reason: "echoHost is required." };
  }

  if (isHttpsBrowserClient()) {
    const proxy = await readEchoSurveyPayload(
      `/api/survey/echo/remote-status?echoHost=${encodeURIComponent(endpoint.host)}&echoHttpPort=${endpoint.port}`,
    );
    if (proxy.ok) {
      return { ...proxy, source: "satellite" };
    }
    return proxy;
  }

  const status = await readRemoteEchoSurveyPayload(endpoint.host, endpoint.port);
  if (!status.ok) {
    return status;
  }
  return { ...status, source: "satellite" };
}

/** Load Echo Spy status from cyberdeck, local dev server, or Echo Satellite tray agent. */
export async function fetchEchoSurveyStatus(): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  const direct = await readEchoSurveyPayload("/api/survey/echo/codes");
  if (direct.ok) {
    return { ...direct, source: "cyberdeck" };
  }

  for (const origin of LOCAL_CYBERDECK_ORIGINS) {
    const local = await readEchoSurveyPayload(`${origin}/api/survey/echo/codes`);
    if (local.ok) {
      return { ...local, source: "local-cyberdeck" };
    }
  }

  const satellite = await readEchoSurveyPayload(SATELLITE_CODES_URL);
  if (satellite.ok) {
    return { ...satellite, source: "satellite" };
  }

  const satelliteStatus = await readEchoSurveyPayload(SATELLITE_STATUS_URL);
  if (satelliteStatus.ok) {
    return { ...satelliteStatus, source: "satellite" };
  }

  return direct;
}

export async function fetchEchoSurveyCodes(): Promise<
  | {
      ok: true;
      echoNodeId: string;
      echoHost: string;
      httpPort: number;
      miragePin: string | null;
      powerfistPin: string | null;
      mirageExpiresAt: string | null;
      powerfistExpiresAt: string | null;
      pairedMirages: SurveyPairedMirage[];
      pairedMirage: SurveyPairedMirage | null;
      pairedPowerfist: { deviceId: string; pairedAt: string } | null;
    }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/survey/echo/codes", { cache: "no-store" });
    const payload = (await res.json()) as Awaited<ReturnType<typeof fetchEchoSurveyCodes>>;
    if (payload.ok) return payload;
  } catch {
    /* try Echo Satellite tray agent */
  }

  try {
    const res = await fetch(SATELLITE_CODES_URL, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    return (await res.json()) as Awaited<ReturnType<typeof fetchEchoSurveyCodes>>;
  } catch {
    return { ok: false, reason: "Could not load Echo pairing codes." };
  }
}

export async function regenerateEchoSurveyCodes(): Promise<
  Awaited<ReturnType<typeof fetchEchoSurveyCodes>>
> {
  try {
    const res = await fetch("/api/survey/echo/codes", { method: "POST" });
    const payload = (await res.json()) as Awaited<ReturnType<typeof fetchEchoSurveyCodes>>;
    if (payload.ok) return payload;
  } catch {
    /* try Echo Satellite tray agent */
  }

  try {
    const res = await fetch(SATELLITE_CODES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
    return (await res.json()) as Awaited<ReturnType<typeof fetchEchoSurveyCodes>>;
  } catch {
    return { ok: false, reason: "Could not regenerate Echo pairing codes." };
  }
}

function evaluateRemoteEchoSurveyLinkStatus(
  status: EchoSurveyStatus,
  input: {
    echoNodeId: string;
    role: "mirage" | "powerfist";
    sessionEpoch: number;
    nodeId?: string;
    deviceId?: string;
  },
):
  | { ok: true; active: true; sessionEpoch: number }
  | { ok: true; active: false; sessionEpoch: number; message: string } {
  const sessionEpoch = status.sessionEpoch ?? input.sessionEpoch;

  if (status.echoSurveyActive === false) {
    return {
      ok: true,
      active: false,
      sessionEpoch,
      message: ECHO_SURVEY_TERMINATED_MESSAGE,
    };
  }

  if (status.echoNodeId && status.echoNodeId !== input.echoNodeId) {
    return {
      ok: true,
      active: false,
      sessionEpoch,
      message: ECHO_SURVEY_TERMINATED_MESSAGE,
    };
  }

  if (input.sessionEpoch !== sessionEpoch) {
    return {
      ok: true,
      active: false,
      sessionEpoch,
      message: ECHO_SURVEY_TERMINATED_MESSAGE,
    };
  }

  if (input.role === "mirage") {
    const nodeId = input.nodeId?.trim();
    const linked = normalizePairedMirages(status).some((mirage) => mirage.nodeId === nodeId);
    if (!nodeId || !linked) {
      return {
        ok: true,
        active: false,
        sessionEpoch,
        message: ECHO_SURVEY_TERMINATED_MESSAGE,
      };
    }
  } else {
    const deviceId = input.deviceId?.trim();
    if (!deviceId || status.pairedPowerfist?.deviceId !== deviceId) {
      return {
        ok: true,
        active: false,
        sessionEpoch,
        message: ECHO_SURVEY_TERMINATED_MESSAGE,
      };
    }
  }

  return { ok: true, active: true, sessionEpoch };
}

export async function fetchEchoSurveyLinkStatus(input: {
  echoNodeId: string;
  role: "mirage" | "powerfist";
  sessionEpoch: number;
  nodeId?: string;
  deviceId?: string;
  echoHost?: string;
  httpPort?: number;
}): Promise<
  | { ok: true; active: true; sessionEpoch: number }
  | { ok: true; active: false; sessionEpoch: number; message: string }
  | { ok: false; reason: string }
> {
  const echoHost = input.echoHost?.trim();
  const httpPort = input.httpPort ?? 3050;

  if (echoHost && typeof window !== "undefined") {
    const remote = await fetchEchoRemoteSurveyCodesClient(echoHost, httpPort);
    if (remote.ok) {
      const result = evaluateRemoteEchoSurveyLinkStatus(remote, input);
      if (!result.active) {
        traceSurveyPairing(`link inactive @ ${echoHost}:${httpPort} — ${result.message}`);
      }
      return result;
    }
    traceSurveyPairing(`link remote codes fail @ ${echoHost}:${httpPort} — ${remote.reason}`);
  }

  try {
    const res = await fetch("/api/survey/pair/link-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        echoNodeId: input.echoNodeId,
        role: input.role,
        sessionEpoch: input.sessionEpoch,
        nodeId: input.nodeId,
        deviceId: input.deviceId,
      }),
    });
    const payload = (await res.json()) as
      | { ok: true; active: true; sessionEpoch: number }
      | { ok: true; active: false; sessionEpoch: number; message: string }
      | { ok: false; reason: string };

    if (!payload.ok && res.status === 403) {
      traceSurveyPairing(`link localhost API blocked (403) — use Echo IP in saved creds`);
      return { ok: false, reason: payload.reason };
    }
    return payload;
  } catch {
    return { ok: false, reason: "Link status check failed." };
  }
}

export function formatCodeExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  return `${minutes} min`;
}
