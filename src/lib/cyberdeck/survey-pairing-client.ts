import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  getOrCreateSurveyNodeId,
  SURVEY_ECHO_LINK_CHANNEL,
} from "@/lib/cyberdeck/survey-mode";
import { discoverEchoEndpointsOnLan } from "@/lib/cyberdeck/survey-echo-discovery.client";
import { parseEchoEndpointInput } from "@/lib/cyberdeck/survey-pair-pin";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";

const SURVEY_MIRAGE_PAIR_STORAGE_KEY = "echo-mirage-survey-mirage-pair";
const SURVEY_POWERFIST_PAIR_STORAGE_KEY = "echo-mirage-survey-powerfist-pair";
const POWERFIST_DEVICE_ID_KEY = "echo-mirage-powerfist-device-id";

export { ECHO_SURVEY_TERMINATED_MESSAGE };

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

const LOCAL_CYBERDECK_ORIGINS = ["http://127.0.0.1:3000", "http://localhost:3000"];
const SATELLITE_STATUS_URL = "http://127.0.0.1:3050/spy/status";
const SATELLITE_CODES_URL = "http://127.0.0.1:3050/api/survey/echo/codes";
const LEGACY_SPY_STATUS_PATH = "/spy/status";
const LEGACY_SPY_PAIR_ENTER_PATH = "/api/spy/pair/enter";

export const SURVEY_PWA_PAIR_BLOCKED_MESSAGE =
  "Installed PWA cannot reach Echo over Tailscale or LAN. On this laptop, click Open desktop cyberdeck below (or run pnpm electron:dev) and pair from there.";

function isHttpsBrowserClient(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/** HTTPS PWA / hosted cyberdeck cannot call Echo Satellite on Tailscale or LAN. */
export function isSurveyHttpsPairBlocked(): boolean {
  return isHttpsBrowserClient() && !isEchoMirageDesktopShell();
}

function isPwaPairReachabilityError(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes("could not reach") ||
    lower.includes("could not find echo") ||
    lower.includes("network") ||
    lower.includes("failed to fetch")
  );
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
  const survey = await readEchoSurveyPayload(
    `http://${host}:${port}/api/survey/echo/codes`,
  );
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

export type SpyMiragePairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  mirageToken: string;
  nodeId: string;
  sessionEpoch: number;
  pairedAt: string;
};

export type SpyPowerfistPairCredentials = {
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  remoteToken: string;
  deviceId: string;
  sessionEpoch: number;
  pairedAt: string;
};

export function getOrCreatePowerfistDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(POWERFIST_DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(POWERFIST_DEVICE_ID_KEY, created);
  return created;
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

export async function enterSurveyPairPin(input: {
  echoHost?: string;
  echoHttpPort: number;
  echoNodeId?: string;
  pin: string;
  role: "mirage" | "powerfist";
  hintHosts?: string[];
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

  type PairSuccess = Extract<Awaited<ReturnType<typeof enterSurveyPairPin>>, { ok: true }>;

  async function postViaCyberdeckProxy(
    host: string,
    port: number,
  ): Promise<PairSuccess | { ok: false; reason: string }> {
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
      const serverResult = (await res.json()) as PairSuccess | { ok: false; reason: string };
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

  async function postDirect(host: string, port: number): Promise<PairSuccess | { ok: false; reason: string }> {
    if (!host.trim()) {
      return { ok: false, reason: "Enter Echo Satellite IP address." };
    }

    async function postPairEnter(path: string): Promise<{
      ok: boolean;
      status: number;
      payload?: PairSuccess | { ok: false; reason: string };
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
          const payload = JSON.parse(text) as PairSuccess | { ok: false; reason: string };
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
      const serverResult = (await res.json()) as PairSuccess | { ok: false; reason: string };
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
    return (await res.json()) as PairSuccess | { ok: false; reason: string };
  } catch {
    return { ok: false, reason: "Pair request failed." };
  }
}

/** @deprecated Legacy long-code pairing — use enterSurveyPairPin instead. */
export async function enterSurveyPairCode(code: string): Promise<
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
  const nodeId = getOrCreateSurveyNodeId();
  const deviceId = getOrCreatePowerfistDeviceId();

  try {
    const res = await fetch("/api/survey/pair/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, nodeId, deviceId }),
    });
    return (await res.json()) as
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
  } catch {
    return { ok: false, reason: "Pair request failed." };
  }
}

export function saveSurveyMiragePairCredentials(creds: SpyMiragePairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyMiragePairCredentials(): SpyMiragePairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpyMiragePairCredentials;
  } catch {
    return null;
  }
}

export function saveSurveyPowerfistPairCredentials(creds: SpyPowerfistPairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSurveyPowerfistPairCredentials(): SpyPowerfistPairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpyPowerfistPairCredentials;
  } catch {
    return null;
  }
}

export function clearSurveyMiragePairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_MIRAGE_PAIR_STORAGE_KEY);
}

export function clearSurveyPowerfistPairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SURVEY_POWERFIST_PAIR_STORAGE_KEY);
}

export function broadcastSurveyEchoTerminated(sessionEpoch: number): void {
  if (typeof window === "undefined") return;
  const payload = { type: "echo-survey-terminated" as const, sessionEpoch };
  try {
    new BroadcastChannel(SURVEY_ECHO_LINK_CHANNEL).postMessage(payload);
  } catch {
    /* BroadcastChannel unavailable */
  }
  window.dispatchEvent(new CustomEvent(SURVEY_ECHO_LINK_CHANNEL, { detail: payload }));
}

export async function terminateEchoSurveySession(): Promise<
  | { ok: true; sessionEpoch: number; message: string }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/survey/echo/terminate", { method: "POST" });
    const payload = (await res.json()) as
      | { ok: true; sessionEpoch: number; message: string }
      | { ok: false; reason: string };
    if (payload.ok) {
      broadcastSurveyEchoTerminated(payload.sessionEpoch);
    }
    return payload;
  } catch {
    return { ok: false, reason: "Could not terminate Echo Survey session." };
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
