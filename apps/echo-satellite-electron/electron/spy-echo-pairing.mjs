import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";

const SPY_PAIR_PIN_LENGTH = 6;
const PAIRING_TTL_MS = 15 * 60 * 1000;
export const ECHO_SPY_TERMINATED_MESSAGE = "ECHO TERMINATED";

/** @type {import("electron").App | null} */
let electronApp = null;

/** @type {EchoSpyPairingState | null} */
let cachedState = null;

/**
 * @typedef {{ pairId: string, pairSecret: string, pin: string, expiresAt: string }} SpyPairCodeSession
 * @typedef {{ nodeId: string, mirageToken: string, pairedAt: string }} SpyPairedMirageClient
 * @typedef {{ deviceId: string, remoteToken: string, pairedAt: string }} SpyPairedPowerfistClient
 * @typedef {{
 *   echoNodeId: string,
 *   httpPort: number,
 *   lanHosts: string[],
 *   updatedAt: string,
 *   echoSpyActive: boolean,
 *   sessionEpoch: number,
 *   mirageCode: SpyPairCodeSession | null,
 *   powerfistCode: SpyPairCodeSession | null,
 *   pairedMirages: SpyPairedMirageClient[],
 *   pairedPowerfist: SpyPairedPowerfistClient | null,
 * }} EchoSpyPairingState
 */

/** @param {import("electron").App} app */
export function initSpyEchoPairing(app) {
  electronApp = app;
}

function pairingStatePath() {
  if (!electronApp) {
    throw new Error("Spy pairing is not initialized.");
  }
  return path.join(electronApp.getPath("userData"), "echo-spy-pairing.json");
}

function getLanHosts() {
  /** @type {string[]} */
  const addrs = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  return addrs.length > 0 ? addrs : ["127.0.0.1"];
}

/** @param {SpyPairCodeSession | null | undefined} session */
function sessionExpired(session) {
  if (!session) return true;
  return Date.parse(session.expiresAt) <= Date.now();
}

function newPairId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function newPairSecret() {
  return crypto.randomBytes(9).toString("base64url");
}

/** @param {Set<string>} taken */
function newPairPin(taken) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const pin = String(
      Math.floor(10 ** (SPY_PAIR_PIN_LENGTH - 1) + Math.random() * 9 * 10 ** (SPY_PAIR_PIN_LENGTH - 1)),
    );
    if (!taken.has(pin)) {
      taken.add(pin);
      return pin;
    }
  }
  throw new Error("Failed to allocate unique Spy pairing PIN.");
}

/** @param {SpyPairCodeSession | null | undefined} session */
function normalizeStoredSession(session) {
  if (!session) return null;
  const pin = session.pin?.trim() || session.pairId?.trim();
  if (!pin || !/^\d{6}$/.test(pin)) return null;
  return { ...session, pin };
}

/** @param {EchoSpyPairingState} state */
function normalizePairedMirages(state) {
  if (Array.isArray(state.pairedMirages) && state.pairedMirages.length > 0) {
    return state.pairedMirages;
  }
  return [];
}

async function defaultState() {
  return {
    echoNodeId: crypto.randomUUID(),
    httpPort: DEFAULT_PAIR_HTTP_PORT,
    lanHosts: getLanHosts(),
    updatedAt: new Date().toISOString(),
    echoSpyActive: false,
    sessionEpoch: 1,
    mirageCode: null,
    powerfistCode: null,
    pairedMirages: [],
    pairedPowerfist: null,
  };
}

export async function loadEchoSpyPairingState() {
  if (cachedState) return cachedState;
  try {
    const raw = JSON.parse(await fs.readFile(pairingStatePath(), "utf8"));
    cachedState = {
      ...raw,
      pairedMirages: normalizePairedMirages(raw),
      echoSpyActive: raw.echoSpyActive ?? false,
      sessionEpoch: raw.sessionEpoch ?? 1,
    };
    return cachedState;
  } catch {
    cachedState = await defaultState();
    return cachedState;
  }
}

/** @param {EchoSpyPairingState} state */
async function saveEchoSpyPairingState(state) {
  state.updatedAt = new Date().toISOString();
  state.lanHosts = getLanHosts();
  state.httpPort = DEFAULT_PAIR_HTTP_PORT;
  cachedState = state;
  const filePath = pairingStatePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

/** @param {Set<string>} takenPins */
function createCodeSession(takenPins) {
  return {
    pairId: newPairId(),
    pairSecret: newPairSecret(),
    pin: newPairPin(takenPins),
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
}

export async function refreshEchoSpyPairCodes() {
  const state = await loadEchoSpyPairingState();
  state.echoSpyActive = true;
  const takenPins = new Set();
  state.mirageCode = createCodeSession(takenPins);
  state.powerfistCode = createCodeSession(takenPins);
  await saveEchoSpyPairingState(state);
  return state;
}

export async function getEchoSpyPairingStatus() {
  let state = await loadEchoSpyPairingState();
  state.echoSpyActive = true;
  const takenPins = new Set();

  if (!state.mirageCode || sessionExpired(state.mirageCode)) {
    if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
      state = await refreshEchoSpyPairCodes();
    } else {
      if (state.powerfistCode.pin) takenPins.add(state.powerfistCode.pin);
      state.mirageCode = createCodeSession(takenPins);
      await saveEchoSpyPairingState(state);
    }
  } else if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
    if (state.mirageCode.pin) takenPins.add(state.mirageCode.pin);
    state.powerfistCode = createCodeSession(takenPins);
    await saveEchoSpyPairingState(state);
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
    echoSpyActive: state.echoSpyActive,
    sessionEpoch: state.sessionEpoch,
  };
}

/**
 * @param {{ pin: string, role: "mirage" | "powerfist", nodeId?: string, deviceId?: string }} input
 */
export async function completeSpyPairEnterByPin(input) {
  const pin = input.pin.trim();
  if (!new RegExp(`^\\d{${SPY_PAIR_PIN_LENGTH}}$`).test(pin)) {
    return { ok: false, reason: `Enter the ${SPY_PAIR_PIN_LENGTH}-digit code from Echo.` };
  }

  const state = await loadEchoSpyPairingState();
  if (!state.echoSpyActive) {
    return { ok: false, reason: ECHO_SPY_TERMINATED_MESSAGE };
  }

  const session = input.role === "mirage" ? state.mirageCode : state.powerfistCode;
  const normalized = normalizeStoredSession(session);

  if (!normalized || sessionExpired(normalized)) {
    return { ok: false, reason: "Pairing code expired. Generate new codes on Echo." };
  }

  if (normalized.pin !== pin) {
    return { ok: false, reason: "Invalid pairing code." };
  }

  return completeSpyPairEnter({
    pairId: normalized.pairId,
    pairSecret: normalized.pairSecret,
    role: input.role,
    nodeId: input.nodeId,
    deviceId: input.deviceId,
  });
}

/**
 * @param {{ pairId: string, pairSecret: string, role: "mirage" | "powerfist", nodeId?: string, deviceId?: string }} input
 */
async function completeSpyPairEnter(input) {
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

    const pairedMirages = normalizePairedMirages(state);
    const existingIdx = pairedMirages.findIndex((mirage) => mirage.nodeId === nodeId);
    const mirageToken =
      (existingIdx >= 0 ? pairedMirages[existingIdx]?.mirageToken : null) ??
      crypto.randomBytes(24).toString("hex");
    const entry = {
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

  const remoteToken = state.pairedPowerfist?.remoteToken ?? crypto.randomBytes(24).toString("hex");
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

/** @returns {Promise<Array<{ nodeId: string, pairedAt: string }>>} */
export async function getLinkedSpyMirages() {
  const state = await loadEchoSpyPairingState();
  return normalizePairedMirages(state);
}
