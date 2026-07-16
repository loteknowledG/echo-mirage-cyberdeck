// SERVER ONLY — Echo-centric Survey pairing (Mirage + PowerFist enter codes from Echo).

import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { SURVEY_PAIR_PIN_LENGTH } from "@/lib/cyberdeck/survey-pair-pin";
import { resolveHttpPort } from "@/lib/server/is-localhost-request.server";
import { resolveEchoTmpPath } from "@/lib/server/echo-runtime-paths.server";

export type SurveyPairRole = "mirage" | "powerfist";

export type SurveyPairCodeSession = {
  pairId: string;
  pairSecret: string;
  pin: string;
  expiresAt: string;
};

export type SurveyPairedMirageClient = {
  nodeId: string;
  mirageToken: string;
  pairedAt: string;
};

export type SurveyPairedPowerfistClient = {
  deviceId: string;
  remoteToken: string;
  pairedAt: string;
};

export type EchoSurveyPairingState = {
  echoNodeId: string;
  httpPort: number;
  lanHosts: string[];
  updatedAt: string;
  /** Survey tab open on Echo — when false, linked Mirage/PowerFist are disconnected. */
  echoSurveyActive: boolean;
  sessionEpoch: number;
  mirageCode: SurveyPairCodeSession | null;
  powerfistCode: SurveyPairCodeSession | null;
  pairedMirages: SurveyPairedMirageClient[];
  pairedPowerfist: SurveyPairedPowerfistClient | null;
  /** @deprecated Migrated to pairedMirages on load */
  pairedMirage?: SurveyPairedMirageClient | null;
};

export const ECHO_SURVEY_TERMINATED_MESSAGE = "ECHO TERMINATED";

const PAIRING_TTL_MS = 15 * 60 * 1000;
const REGISTRY_KEY = "__echoMirageSpyEchoPairing";

function echoSpyPairingStatePath(): string {
  return (
    process.env.ECHO_MIRAGE_SPY_PAIRING_STATE_PATH?.trim() ||
    resolveEchoTmpPath("echo-spy-pairing.json")
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

function registryStore(): { state: EchoSurveyPairingState | null } {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: { state: EchoSurveyPairingState | null };
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = { state: null };
  }
  return globalStore[REGISTRY_KEY];
}

function sessionExpired(session: SurveyPairCodeSession | null | undefined): boolean {
  if (!session) return true;
  return Date.parse(session.expiresAt) <= Date.now();
}

function newPairId(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function newPairSecret(): string {
  return crypto.randomBytes(9).toString("base64url");
}

function newPairPin(taken: Set<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const pin = String(Math.floor(10 ** (SURVEY_PAIR_PIN_LENGTH - 1) + Math.random() * 9 * 10 ** (SURVEY_PAIR_PIN_LENGTH - 1)));
    if (!taken.has(pin)) {
      taken.add(pin);
      return pin;
    }
  }
  throw new Error("Failed to allocate unique Survey pairing PIN.");
}

function normalizeStoredSession(session: SurveyPairCodeSession | null | undefined): SurveyPairCodeSession | null {
  if (!session) return null;
  const pin = session.pin?.trim() || session.pairId?.trim();
  if (!pin || !/^\d{6}$/.test(pin)) return null;
  return { ...session, pin };
}

async function defaultState(): Promise<EchoSurveyPairingState> {
  return {
    echoNodeId: crypto.randomUUID(),
    httpPort: resolveHttpPort(),
    lanHosts: getLanHosts(),
    updatedAt: new Date().toISOString(),
    echoSurveyActive: false,
    sessionEpoch: 1,
    mirageCode: null,
    powerfistCode: null,
    pairedMirages: [],
    pairedPowerfist: null,
  };
}

export function normalizePairedMirages(
  state: Pick<EchoSurveyPairingState, "pairedMirages"> & { pairedMirage?: SurveyPairedMirageClient | null },
): SurveyPairedMirageClient[] {
  if (Array.isArray(state.pairedMirages) && state.pairedMirages.length > 0) {
    return state.pairedMirages;
  }
  if (state.pairedMirage) {
    return [state.pairedMirage];
  }
  return [];
}

function normalizeEchoSurveyState(state: EchoSurveyPairingState): EchoSurveyPairingState {
  const pairedMirages = normalizePairedMirages(state);
  return {
    ...state,
    echoSurveyActive: state.echoSurveyActive ?? false,
    sessionEpoch: state.sessionEpoch ?? 1,
    pairedMirages,
  };
}

export async function loadEchoSurveyPairingState(): Promise<EchoSurveyPairingState> {
  const store = registryStore();
  if (store.state) return store.state;

  try {
    const raw = normalizeEchoSurveyState(
      JSON.parse(await fs.readFile(echoSpyPairingStatePath(), "utf8")) as EchoSurveyPairingState,
    );
    store.state = raw;
    return raw;
  } catch {
    const created = await defaultState();
    store.state = created;
    return created;
  }
}

export async function saveEchoSurveyPairingState(state: EchoSurveyPairingState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  state.lanHosts = getLanHosts();
  state.httpPort = resolveHttpPort();
  registryStore().state = state;
  const statePath = echoSpyPairingStatePath();
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function createCodeSession(takenPins: Set<string>): SurveyPairCodeSession {
  return {
    pairId: newPairId(),
    pairSecret: newPairSecret(),
    pin: newPairPin(takenPins),
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
}

export function formatSurveyPairCode(
  host: string,
  httpPort: number,
  session: SurveyPairCodeSession,
  role: SurveyPairRole,
): string {
  const tag = role === "mirage" ? "M" : "P";
  return `${host}:${httpPort}:${session.pairId}:${session.pairSecret}:${tag}`;
}

export function parseSurveyPairCode(raw: string): {
  host: string;
  httpPort: number;
  pairId: string;
  pairSecret: string;
  role: SurveyPairRole;
} | null {
  const parts = raw.trim().split(":");
  if (parts.length < 5) return null;

  const roleTag = parts[parts.length - 1]?.toUpperCase();
  const role: SurveyPairRole | null =
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

export async function activateEchoSurveySession(): Promise<EchoSurveyPairingState> {
  const state = await loadEchoSurveyPairingState();
  state.echoSurveyActive = true;
  await saveEchoSurveyPairingState(state);
  return state;
}

export async function terminateEchoSurveySession(): Promise<{
  ok: true;
  sessionEpoch: number;
  message: string;
}> {
  const state = await loadEchoSurveyPairingState();
  state.echoSurveyActive = false;
  state.sessionEpoch += 1;
  state.mirageCode = null;
  state.powerfistCode = null;
  state.pairedMirages = [];
  state.pairedPowerfist = null;
  await saveEchoSurveyPairingState(state);
  return {
    ok: true,
    sessionEpoch: state.sessionEpoch,
    message: ECHO_SURVEY_TERMINATED_MESSAGE,
  };
}

export async function refreshEchoSurveyPairCodes(): Promise<EchoSurveyPairingState> {
  const state = await loadEchoSurveyPairingState();
  state.echoSurveyActive = true;
  const takenPins = new Set<string>();
  state.mirageCode = createCodeSession(takenPins);
  state.powerfistCode = createCodeSession(takenPins);
  await saveEchoSurveyPairingState(state);
  return state;
}

export async function getEchoSurveyPairingStatus(): Promise<{
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  miragePin: string | null;
  powerfistPin: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirages: SurveyPairedMirageClient[];
  /** First linked Mirage — legacy alias for single-client consumers */
  pairedMirage: SurveyPairedMirageClient | null;
  pairedPowerfist: SurveyPairedPowerfistClient | null;
  echoSurveyActive: boolean;
  sessionEpoch: number;
}> {
  let state = await loadEchoSurveyPairingState();
  state.echoSurveyActive = true;
  const takenPins = new Set<string>();
  if (!state.mirageCode || sessionExpired(state.mirageCode)) {
    if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
      state = await refreshEchoSurveyPairCodes();
    } else {
      if (state.powerfistCode.pin) takenPins.add(state.powerfistCode.pin);
      state.mirageCode = createCodeSession(takenPins);
      await saveEchoSurveyPairingState(state);
    }
  } else if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
    if (state.mirageCode.pin) takenPins.add(state.mirageCode.pin);
    state.powerfistCode = createCodeSession(takenPins);
    await saveEchoSurveyPairingState(state);
  }

  const host = state.lanHosts[0] || "127.0.0.1";
  const mirageSession = normalizeStoredSession(state.mirageCode);
  const powerfistSession = normalizeStoredSession(state.powerfistCode);
  const mirageActive = mirageSession && !sessionExpired(mirageSession);
  const powerfistActive = powerfistSession && !sessionExpired(powerfistSession);

  const pairedMirages = normalizePairedMirages(state);

  return {
    echoNodeId: state.echoNodeId,
    echoHost: host,
    httpPort: state.httpPort,
    miragePin: mirageActive ? mirageSession.pin : null,
    powerfistPin: powerfistActive ? powerfistSession.pin : null,
    mirageExpiresAt: mirageActive ? mirageSession.expiresAt : null,
    powerfistExpiresAt: powerfistActive ? powerfistSession.expiresAt : null,
    pairedMirages,
    pairedMirage: pairedMirages[0] ?? null,
    pairedPowerfist: state.pairedPowerfist,
    echoSurveyActive: state.echoSurveyActive,
    sessionEpoch: state.sessionEpoch,
  };
}

export async function checkEchoSurveyLinkStatus(input: {
  echoNodeId: string;
  role: SurveyPairRole;
  sessionEpoch: number;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | { ok: true; active: true; sessionEpoch: number }
  | { ok: true; active: false; sessionEpoch: number; message: string }
> {
  const state = await loadEchoSurveyPairingState();

  if (!state.echoSurveyActive || state.echoNodeId !== input.echoNodeId) {
    return {
      ok: true,
      active: false,
      sessionEpoch: state.sessionEpoch,
      message: ECHO_SURVEY_TERMINATED_MESSAGE,
    };
  }

  if (input.sessionEpoch !== state.sessionEpoch) {
    return {
      ok: true,
      active: false,
      sessionEpoch: state.sessionEpoch,
      message: ECHO_SURVEY_TERMINATED_MESSAGE,
    };
  }

  if (input.role === "mirage") {
    const nodeId = input.nodeId?.trim();
    const linked = normalizePairedMirages(state).some((mirage) => mirage.nodeId === nodeId);
    if (!nodeId || !linked) {
      return {
        ok: true,
        active: false,
        sessionEpoch: state.sessionEpoch,
        message: ECHO_SURVEY_TERMINATED_MESSAGE,
      };
    }
  } else {
    const deviceId = input.deviceId?.trim();
    if (!deviceId || !state.pairedPowerfist || state.pairedPowerfist.deviceId !== deviceId) {
      return {
        ok: true,
        active: false,
        sessionEpoch: state.sessionEpoch,
        message: ECHO_SURVEY_TERMINATED_MESSAGE,
      };
    }
  }

  return { ok: true, active: true, sessionEpoch: state.sessionEpoch };
}

export async function completeSurveyPairEnterByPin(input: {
  pin: string;
  role: SurveyPairRole;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | {
      ok: true;
      role: SurveyPairRole;
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
  const pin = input.pin.trim();
  if (!new RegExp(`^\\d{${SURVEY_PAIR_PIN_LENGTH}}$`).test(pin)) {
    return { ok: false, reason: `Enter the ${SURVEY_PAIR_PIN_LENGTH}-digit code from Echo.` };
  }

  const state = await loadEchoSurveyPairingState();

  if (!state.echoSurveyActive) {
    return { ok: false, reason: ECHO_SURVEY_TERMINATED_MESSAGE };
  }

  const session = input.role === "mirage" ? state.mirageCode : state.powerfistCode;
  const normalized = normalizeStoredSession(session);

  if (!normalized || sessionExpired(normalized)) {
    return { ok: false, reason: "Pairing code expired. Generate new codes on Echo." };
  }

  if (normalized.pin !== pin) {
    return { ok: false, reason: "Invalid pairing code." };
  }

  return completeSurveyPairEnter({
    pairId: normalized.pairId,
    pairSecret: normalized.pairSecret,
    role: input.role,
    nodeId: input.nodeId,
    deviceId: input.deviceId,
  });
}

export async function completeSurveyPairEnter(input: {
  pairId: string;
  pairSecret: string;
  role: SurveyPairRole;
  nodeId?: string;
  deviceId?: string;
}): Promise<
  | {
      ok: true;
      role: SurveyPairRole;
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
  const state = await loadEchoSurveyPairingState();

  if (!state.echoSurveyActive) {
    return { ok: false, reason: ECHO_SURVEY_TERMINATED_MESSAGE };
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

    const pairedMirages = normalizePairedMirages(state);
    const existingIdx = pairedMirages.findIndex((mirage) => mirage.nodeId === nodeId);
    const mirageToken =
      (existingIdx >= 0 ? pairedMirages[existingIdx]?.mirageToken : null) ??
      crypto.randomBytes(24).toString("hex");
    const entry: SurveyPairedMirageClient = {
      nodeId,
      mirageToken,
      pairedAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      pairedMirages[existingIdx] = entry;
    } else {
      pairedMirages.push(entry);
    }
    state.pairedMirages = pairedMirages;
    state.mirageCode = null;
    await saveEchoSurveyPairingState(state);

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
  await saveEchoSurveyPairingState(state);

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
