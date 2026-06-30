import {
  ECHO_SPY_TERMINATED_MESSAGE,
  getOrCreateEspionageNodeId,
  SPY_ECHO_LINK_CHANNEL,
} from "@/lib/cyberdeck/espionage-mode";
import { discoverEchoEndpointsOnLan } from "@/lib/cyberdeck/spy-echo-discovery.client";
import { parseEchoEndpointInput } from "@/lib/cyberdeck/spy-pair-pin";

const SPY_MIRAGE_PAIR_STORAGE_KEY = "echo-mirage-spy-mirage-pair";
const SPY_POWERFIST_PAIR_STORAGE_KEY = "echo-mirage-spy-powerfist-pair";
const POWERFIST_DEVICE_ID_KEY = "echo-mirage-powerfist-device-id";

export { ECHO_SPY_TERMINATED_MESSAGE };

export type SpyPairedMirage = {
  nodeId: string;
  pairedAt: string;
};

export function normalizePairedMirages(status: {
  pairedMirages?: SpyPairedMirage[];
  pairedMirage?: SpyPairedMirage | null;
}): SpyPairedMirage[] {
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

export type EchoSpyStatusSource = "cyberdeck" | "local-cyberdeck" | "satellite";

export type EchoSpyStatus = {
  ok: true;
  source: EchoSpyStatusSource;
  echoNodeId?: string;
  echoHost: string;
  httpPort: number;
  miragePin: string | null;
  powerfistPin: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirages: SpyPairedMirage[];
  pairedMirage: SpyPairedMirage | null;
  pairedPowerfist: { deviceId: string; pairedAt: string } | null;
  armed?: boolean;
  wsStatus?: string;
  captureMirage?: { host: string; port: number } | null;
  spyLinksReachable?: boolean;
};

async function readEchoSpyPayload(url: string): Promise<EchoSpyStatus | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      return { ok: false, reason: `Request failed (${res.status}).` };
    }
    const payload = (await res.json()) as EchoSpyStatus | { ok: false; reason?: string };
    if (!payload.ok) {
      return { ok: false, reason: payload.reason ?? "Could not load Echo Spy status." };
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
    };
  } catch {
    return { ok: false, reason: "Could not reach Echo status endpoint." };
  }
}

/** Load Echo Spy status from cyberdeck, local dev server, or Echo Satellite tray agent. */
export async function fetchEchoSpyStatus(): Promise<EchoSpyStatus | { ok: false; reason: string }> {
  const direct = await readEchoSpyPayload("/api/spy/echo/codes");
  if (direct.ok) {
    return { ...direct, source: "cyberdeck" };
  }

  for (const origin of LOCAL_CYBERDECK_ORIGINS) {
    const local = await readEchoSpyPayload(`${origin}/api/spy/echo/codes`);
    if (local.ok) {
      return { ...local, source: "local-cyberdeck" };
    }
  }

  const satellite = await readEchoSpyPayload(SATELLITE_STATUS_URL);
  if (satellite.ok) {
    return { ...satellite, source: "satellite" };
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

export async function fetchEchoSpyCodes(): Promise<
  | {
      ok: true;
      echoNodeId: string;
      echoHost: string;
      httpPort: number;
      miragePin: string | null;
      powerfistPin: string | null;
      mirageExpiresAt: string | null;
      powerfistExpiresAt: string | null;
      pairedMirages: SpyPairedMirage[];
      pairedMirage: SpyPairedMirage | null;
      pairedPowerfist: { deviceId: string; pairedAt: string } | null;
    }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/spy/echo/codes", { cache: "no-store" });
    return (await res.json()) as Awaited<ReturnType<typeof fetchEchoSpyCodes>>;
  } catch {
    return { ok: false, reason: "Could not load Echo pairing codes." };
  }
}

export async function regenerateEchoSpyCodes(): Promise<
  Awaited<ReturnType<typeof fetchEchoSpyCodes>>
> {
  try {
    const res = await fetch("/api/spy/echo/codes", { method: "POST" });
    return (await res.json()) as Awaited<ReturnType<typeof fetchEchoSpyCodes>>;
  } catch {
    return { ok: false, reason: "Could not regenerate Echo pairing codes." };
  }
}

export async function enterSpyPairPin(input: {
  echoHost?: string;
  echoHttpPort: number;
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
  const nodeId = getOrCreateEspionageNodeId();
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

  type PairSuccess = Extract<Awaited<ReturnType<typeof enterSpyPairPin>>, { ok: true }>;

  async function postDirect(host: string, port: number): Promise<PairSuccess | { ok: false; reason: string }> {
    if (!host.trim()) {
      return { ok: false, reason: "Enter Echo IP address under Advanced." };
    }
    try {
      const res = await fetch(`http://${host}:${port}/api/spy/pair/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        mode: "cors",
        signal: AbortSignal.timeout(8_000),
      });
      const text = await res.text();
      let payload: PairSuccess | { ok: false; reason: string };
      try {
        payload = JSON.parse(text) as PairSuccess | { ok: false; reason: string };
      } catch {
        return {
          ok: false,
          reason: `Echo at ${host}:${port} returned an unexpected response (HTTP ${res.status}).`,
        };
      }
      if (payload.ok) {
        return {
          ...payload,
          echoHost: payload.echoHost || host,
          httpPort: payload.httpPort || port,
        };
      }
      return payload;
    } catch (error) {
      const detail =
        error instanceof Error && error.name === "TimeoutError"
          ? "Timed out — check Echo Satellite is running and Screen Recording is granted."
          : "";
      return {
        ok: false,
        reason: [`Could not reach Echo at ${host}:${port}.`, detail].filter(Boolean).join(" "),
      };
    }
  }

  if (typeof window !== "undefined") {
    if (resolvedEndpoint.host) {
      return postDirect(resolvedEndpoint.host, resolvedEndpoint.port);
    }

    try {
      const res = await fetch("/api/spy/pair/enter", {
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
      if (serverResult.ok) return serverResult;
      const reason = serverResult.reason?.toLowerCase() ?? "";
      if (reason.includes("invalid pairing code") || reason.includes("expired")) {
        return serverResult;
      }
    } catch {
      /* hosted PWA or server unreachable — try browser LAN discovery */
    }

    const endpoints = await discoverEchoEndpointsOnLan(input.hintHosts ?? []);

    if (endpoints.length === 0) {
      return {
        ok: false,
        reason:
          "Could not find Echo on your LAN. Open Echo Satellite on the screenshot Mac (same Wi‑Fi), or enter its IP under Advanced.",
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
    const res = await fetch("/api/spy/pair/enter", {
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

/** @deprecated Legacy long-code pairing — use enterSpyPairPin instead. */
export async function enterSpyPairCode(code: string): Promise<
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
  const nodeId = getOrCreateEspionageNodeId();
  const deviceId = getOrCreatePowerfistDeviceId();

  try {
    const res = await fetch("/api/spy/pair/enter", {
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

export function saveSpyMiragePairCredentials(creds: SpyMiragePairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPY_MIRAGE_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSpyMiragePairCredentials(): SpyMiragePairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SPY_MIRAGE_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpyMiragePairCredentials;
  } catch {
    return null;
  }
}

export function saveSpyPowerfistPairCredentials(creds: SpyPowerfistPairCredentials): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPY_POWERFIST_PAIR_STORAGE_KEY, JSON.stringify(creds));
}

export function readSpyPowerfistPairCredentials(): SpyPowerfistPairCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SPY_POWERFIST_PAIR_STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SpyPowerfistPairCredentials;
  } catch {
    return null;
  }
}

export function clearSpyMiragePairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SPY_MIRAGE_PAIR_STORAGE_KEY);
}

export function clearSpyPowerfistPairCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SPY_POWERFIST_PAIR_STORAGE_KEY);
}

export function broadcastSpyEchoTerminated(sessionEpoch: number): void {
  if (typeof window === "undefined") return;
  const payload = { type: "echo-spy-terminated" as const, sessionEpoch };
  try {
    new BroadcastChannel(SPY_ECHO_LINK_CHANNEL).postMessage(payload);
  } catch {
    /* BroadcastChannel unavailable */
  }
  window.dispatchEvent(new CustomEvent(SPY_ECHO_LINK_CHANNEL, { detail: payload }));
}

export async function terminateEchoSpySession(): Promise<
  | { ok: true; sessionEpoch: number; message: string }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/spy/echo/terminate", { method: "POST" });
    const payload = (await res.json()) as
      | { ok: true; sessionEpoch: number; message: string }
      | { ok: false; reason: string };
    if (payload.ok) {
      broadcastSpyEchoTerminated(payload.sessionEpoch);
    }
    return payload;
  } catch {
    return { ok: false, reason: "Could not terminate Echo Spy session." };
  }
}

export async function fetchEchoSpyLinkStatus(input: {
  echoNodeId: string;
  role: "mirage" | "powerfist";
  sessionEpoch: number;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | { ok: true; active: true; sessionEpoch: number }
  | { ok: true; active: false; sessionEpoch: number; message: string }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/spy/pair/link-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as
      | { ok: true; active: true; sessionEpoch: number }
      | { ok: true; active: false; sessionEpoch: number; message: string }
      | { ok: false; reason: string };
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
