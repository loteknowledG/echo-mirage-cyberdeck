// SERVER ONLY — Echo-centric Spy pairing (Mirage + PowerFist enter codes from Echo).

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveHttpPort } from "@/lib/server/is-localhost-request.server";

export type SpyPairRole = "mirage" | "powerfist";

export type SpyPairCodeSession = {
  pairId: string;
  pairSecret: string;
  expiresAt: string;
};

export type SpyPairedMirageClient = {
  nodeId: string;
  mirageToken: string;
  pairedAt: string;
};

export type SpyPairedPowerfistClient = {
  deviceId: string;
  remoteToken: string;
  pairedAt: string;
};

export type EchoSpyPairingState = {
  echoNodeId: string;
  httpPort: number;
  lanHosts: string[];
  updatedAt: string;
  /** Spy tab open on Echo — when false, linked Mirage/PowerFist are disconnected. */
  echoSpyActive: boolean;
  sessionEpoch: number;
  mirageCode: SpyPairCodeSession | null;
  powerfistCode: SpyPairCodeSession | null;
  pairedMirage: SpyPairedMirageClient | null;
  pairedPowerfist: SpyPairedPowerfistClient | null;
};

export const ECHO_SPY_TERMINATED_MESSAGE = "ECHO TERMINATED";

const PAIRING_TTL_MS = 15 * 60 * 1000;
const REGISTRY_KEY = "__echoMirageSpyEchoPairing";

function echoSpyPairingStatePath(): string {
  return (
    process.env.ECHO_MIRAGE_SPY_PAIRING_STATE_PATH?.trim() ||
    path.join(process.cwd(), ".tmp", "echo-spy-pairing.json")
  );
}

function getLanHosts(): string[] {
  const addrs: string[] = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
  return addrs.length > 0 ? addrs : ["127.0.0.1"];
}

function registryStore(): { state: EchoSpyPairingState | null } {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: { state: EchoSpyPairingState | null };
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = { state: null };
  }
  return globalStore[REGISTRY_KEY];
}

function sessionExpired(session: SpyPairCodeSession | null | undefined): boolean {
  if (!session) return true;
  return Date.parse(session.expiresAt) <= Date.now();
}

function newPairId(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function newPairSecret(): string {
  return crypto.randomBytes(9).toString("base64url");
}

async function defaultState(): Promise<EchoSpyPairingState> {
  return {
    echoNodeId: crypto.randomUUID(),
    httpPort: resolveHttpPort(),
    lanHosts: getLanHosts(),
    updatedAt: new Date().toISOString(),
    echoSpyActive: false,
    sessionEpoch: 1,
    mirageCode: null,
    powerfistCode: null,
    pairedMirage: null,
    pairedPowerfist: null,
  };
}

function normalizeEchoSpyState(state: EchoSpyPairingState): EchoSpyPairingState {
  return {
    ...state,
    echoSpyActive: state.echoSpyActive ?? false,
    sessionEpoch: state.sessionEpoch ?? 1,
  };
}

export async function loadEchoSpyPairingState(): Promise<EchoSpyPairingState> {
  const store = registryStore();
  if (store.state) return store.state;

  try {
    const raw = normalizeEchoSpyState(
      JSON.parse(await fs.readFile(echoSpyPairingStatePath(), "utf8")) as EchoSpyPairingState,
    );
    store.state = raw;
    return raw;
  } catch {
    const created = await defaultState();
    store.state = created;
    return created;
  }
}

export async function saveEchoSpyPairingState(state: EchoSpyPairingState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.lanHosts = getLanHosts();
  state.httpPort = resolveHttpPort();
  registryStore().state = state;
  const statePath = echoSpyPairingStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function createCodeSession(): SpyPairCodeSession {
  return {
    pairId: newPairId(),
    pairSecret: newPairSecret(),
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
}

export function formatSpyPairCode(
  host: string,
  httpPort: number,
  session: SpyPairCodeSession,
  role: SpyPairRole,
): string {
  const tag = role === "mirage" ? "M" : "P";
  return `${host}:${httpPort}:${session.pairId}:${session.pairSecret}:${tag}`;
}

export function parseSpyPairCode(raw: string): {
  host: string;
  httpPort: number;
  pairId: string;
  pairSecret: string;
  role: SpyPairRole;
} | null {
  const parts = raw.trim().split(":");
  if (parts.length < 5) return null;

  const roleTag = parts[parts.length - 1]?.toUpperCase();
  const role: SpyPairRole | null =
    roleTag === "M" ? "mirage" : roleTag === "P" ? "powerfist" : null;
  if (!role) return null;

  const pairSecret = parts[parts.length - 2] ?? "";
  const pairId = parts[parts.length - 3] ?? "";
  const httpPort = Number(parts[parts.length - 4]);
  const host = parts.slice(0, parts.length - 4).join(":");

  if (!host || !pairId || !pairSecret || !Number.isFinite(httpPort) || httpPort <= 0) {
    return null;
  }

  return { host, httpPort, pairId, pairSecret, role };
}

export async function activateEchoSpySession(): Promise<EchoSpyPairingState> {
  const state = await loadEchoSpyPairingState();
  state.echoSpyActive = true;
  await saveEchoSpyPairingState(state);
  return state;
}

export async function terminateEchoSpySession(): Promise<{
  ok: true;
  sessionEpoch: number;
  message: string;
}> {
  const state = await loadEchoSpyPairingState();
  state.echoSpyActive = false;
  state.sessionEpoch += 1;
  state.mirageCode = null;
  state.powerfistCode = null;
  state.pairedMirage = null;
  state.pairedPowerfist = null;
  await saveEchoSpyPairingState(state);
  return {
    ok: true,
    sessionEpoch: state.sessionEpoch,
    message: ECHO_SPY_TERMINATED_MESSAGE,
  };
}

export async function refreshEchoSpyPairCodes(): Promise<EchoSpyPairingState> {
  const state = await loadEchoSpyPairingState();
  state.echoSpyActive = true;
  state.mirageCode = createCodeSession();
  state.powerfistCode = createCodeSession();
  await saveEchoSpyPairingState(state);
  return state;
}

export async function getEchoSpyPairingStatus(): Promise<{
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  mirageCode: string | null;
  powerfistCode: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirage: SpyPairedMirageClient | null;
  pairedPowerfist: SpyPairedPowerfistClient | null;
  echoSpyActive: boolean;
  sessionEpoch: number;
}> {
  let state = await loadEchoSpyPairingState();
  state.echoSpyActive = true;
  if (!state.mirageCode || sessionExpired(state.mirageCode)) {
    if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
      state = await refreshEchoSpyPairCodes();
    } else {
      state.mirageCode = createCodeSession();
      await saveEchoSpyPairingState(state);
    }
  } else if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
    state.powerfistCode = createCodeSession();
    await saveEchoSpyPairingState(state);
  }

  const host = state.lanHosts[0] || "127.0.0.1";
  const mirageActive = state.mirageCode && !sessionExpired(state.mirageCode);
  const powerfistActive = state.powerfistCode && !sessionExpired(state.powerfistCode);

  return {
    echoNodeId: state.echoNodeId,
    echoHost: host,
    httpPort: state.httpPort,
    mirageCode: mirageActive && state.mirageCode
      ? formatSpyPairCode(host, state.httpPort, state.mirageCode, "mirage")
      : null,
    powerfistCode: powerfistActive && state.powerfistCode
      ? formatSpyPairCode(host, state.httpPort, state.powerfistCode, "powerfist")
      : null,
    mirageExpiresAt: mirageActive ? state.mirageCode?.expiresAt ?? null : null,
    powerfistExpiresAt: powerfistActive ? state.powerfistCode?.expiresAt ?? null : null,
    pairedMirage: state.pairedMirage,
    pairedPowerfist: state.pairedPowerfist,
    echoSpyActive: state.echoSpyActive,
    sessionEpoch: state.sessionEpoch,
  };
}

export async function checkEchoSpyLinkStatus(input: {
  echoNodeId: string;
  role: SpyPairRole;
  sessionEpoch: number;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | { ok: true; active: true; sessionEpoch: number }
  | { ok: true; active: false; sessionEpoch: number; message: string }
> {
  const state = await loadEchoSpyPairingState();

  if (!state.echoSpyActive || state.echoNodeId !== input.echoNodeId) {
    return {
      ok: true,
      active: false,
      sessionEpoch: state.sessionEpoch,
      message: ECHO_SPY_TERMINATED_MESSAGE,
    };
  }

  if (input.sessionEpoch !== state.sessionEpoch) {
    return {
      ok: true,
      active: false,
      sessionEpoch: state.sessionEpoch,
      message: ECHO_SPY_TERMINATED_MESSAGE,
    };
  }

  if (input.role === "mirage") {
    const nodeId = input.nodeId?.trim();
    if (!nodeId || !state.pairedMirage || state.pairedMirage.nodeId !== nodeId) {
      return {
        ok: true,
        active: false,
        sessionEpoch: state.sessionEpoch,
        message: ECHO_SPY_TERMINATED_MESSAGE,
      };
    }
  } else {
    const deviceId = input.deviceId?.trim();
    if (!deviceId || !state.pairedPowerfist || state.pairedPowerfist.deviceId !== deviceId) {
      return {
        ok: true,
        active: false,
        sessionEpoch: state.sessionEpoch,
        message: ECHO_SPY_TERMINATED_MESSAGE,
      };
    }
  }

  return { ok: true, active: true, sessionEpoch: state.sessionEpoch };
}

export async function completeSpyPairEnter(input: {
  pairId: string;
  pairSecret: string;
  role: SpyPairRole;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | {
      ok: true;
      role: SpyPairRole;
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
  const state = await loadEchoSpyPairingState();

  if (!state.echoSpyActive) {
    return { ok: false, reason: ECHO_SPY_TERMINATED_MESSAGE };
  }

  const session = input.role === "mirage" ? state.mirageCode : state.powerfistCode;

  if (!session || sessionExpired(session)) {
    return { ok: false, reason: "Pairing code expired. Generate new codes on Echo." };
  }

  if (session.pairId !== input.pairId || session.pairSecret !== input.pairSecret) {
    return { ok: false, reason: "Invalid pairing code." };
  }

  const host = state.lanHosts[0] || "127.0.0.1";

  if (input.role === "mirage") {
    const nodeId = input.nodeId?.trim();
    if (!nodeId) {
      return { ok: false, reason: "nodeId is required for Mirage pairing." };
    }

    const mirageToken =
      state.pairedMirage?.mirageToken ?? crypto.randomBytes(24).toString("hex");
    state.pairedMirage = {
      nodeId,
      mirageToken,
      pairedAt: new Date().toISOString(),
    };
    state.mirageCode = null;
    await saveEchoSpyPairingState(state);

    return {
      ok: true,
      role: "mirage",
      echoNodeId: state.echoNodeId,
      echoHost: host,
      httpPort: state.httpPort,
      token: mirageToken,
      nodeId,
      sessionEpoch: state.sessionEpoch,
    };
  }

  const deviceId = input.deviceId?.trim();
  if (!deviceId) {
    return { ok: false, reason: "deviceId is required for PowerFist pairing." };
  }

  const remoteToken =
    state.pairedPowerfist?.remoteToken ?? crypto.randomBytes(24).toString("hex");
  state.pairedPowerfist = {
    deviceId,
    remoteToken,
    pairedAt: new Date().toISOString(),
  };
  state.powerfistCode = null;
  await saveEchoSpyPairingState(state);

  return {
    ok: true,
    role: "powerfist",
    echoNodeId: state.echoNodeId,
    echoHost: host,
    httpPort: state.httpPort,
    token: remoteToken,
    deviceId,
    sessionEpoch: state.sessionEpoch,
  };
}
