import {
  ECHO_SPY_TERMINATED_MESSAGE,
  getOrCreateEspionageNodeId,
  SPY_ECHO_LINK_CHANNEL,
} from "@/lib/cyberdeck/espionage-mode";

const SPY_MIRAGE_PAIR_STORAGE_KEY = "echo-mirage-spy-mirage-pair";
const SPY_POWERFIST_PAIR_STORAGE_KEY = "echo-mirage-spy-powerfist-pair";
const POWERFIST_DEVICE_ID_KEY = "echo-mirage-powerfist-device-id";

export { ECHO_SPY_TERMINATED_MESSAGE };

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
      mirageCode: string | null;
      powerfistCode: string | null;
      mirageExpiresAt: string | null;
      powerfistExpiresAt: string | null;
      pairedMirage: { nodeId: string; pairedAt: string } | null;
      pairedPowerfist: { deviceId: string; pairedAt: string } | null;
    }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/spy/echo/codes", { cache: "no-store" });
    return (await res.json()) as
      | {
          ok: true;
          echoNodeId: string;
          echoHost: string;
          httpPort: number;
          mirageCode: string | null;
          powerfistCode: string | null;
          mirageExpiresAt: string | null;
          powerfistExpiresAt: string | null;
          pairedMirage: { nodeId: string; pairedAt: string } | null;
          pairedPowerfist: { deviceId: string; pairedAt: string } | null;
        }
      | { ok: false; reason: string };
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
