import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";

export const SPY_PAIR_PIN_LENGTH = 6;
export const ECHO_SPY_TERMINATED_MESSAGE = "ECHO TERMINATED";
const PAIRING_TTL_MS = 15 * 60 * 1000;

/** @typedef {"mirage"|"powerfist"} SpyPairRole */

/**
 * @typedef {{
 *   pairId: string,
 *   pairSecret: string,
 *   pin: string,
 *   expiresAt: string,
 * }} SpyPairCodeSession
 */

/**
 * @typedef {{
 *   echoNodeId: string,
 *   httpPort: number,
 *   lanHosts: string[],
 *   updatedAt: string,
 *   echoSpyActive: boolean,
 *   sessionEpoch: number,
 *   mirageCode: SpyPairCodeSession | null,
 *   powerfistCode: SpyPairCodeSession | null,
 *   pairedMirage: { nodeId: string, mirageToken: string, pairedAt: string } | null,
 *   pairedPowerfist: { deviceId: string, remoteToken: string, pairedAt: string } | null,
 * }} EchoSpyPairingState
 */

/**
 * @param {import('electron').App} app
 * @param {() => Promise<string>} getNodeId
 */
export function createSpyPairing(app, getNodeId) {
  /** @type {EchoSpyPairingState | null} */
  let cached = null;

  function statePath() {
    return path.join(app.getPath("userData"), "echo-spy-pairing.json");
  }

  function getLanHosts() {
    const addrs = [];
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const net of entries ?? []) {
        if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
      }
    }
    return addrs.length > 0 ? addrs : ["127.0.0.1"];
  }

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

  /** @param {Set<string>} takenPins */
  function createCodeSession(takenPins) {
    return {
      pairId: newPairId(),
      pairSecret: newPairSecret(),
      pin: newPairPin(takenPins),
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
    };
  }

  /** @returns {Promise<EchoSpyPairingState>} */
  async function defaultState() {
    return {
      echoNodeId: await getNodeId(),
      httpPort: DEFAULT_PAIR_HTTP_PORT,
      lanHosts: getLanHosts(),
      updatedAt: new Date().toISOString(),
      echoSpyActive: true,
      sessionEpoch: 1,
      mirageCode: null,
      powerfistCode: null,
      pairedMirage: null,
      pairedPowerfist: null,
    };
  }

  /** @returns {Promise<EchoSpyPairingState>} */
  async function loadState() {
    if (cached) return cached;
    try {
      const raw = JSON.parse(await fs.readFile(statePath(), "utf8"));
      cached = {
        ...raw,
        echoSpyActive: raw.echoSpyActive ?? true,
        sessionEpoch: raw.sessionEpoch ?? 1,
      };
      return cached;
    } catch {
      cached = await defaultState();
      return cached;
    }
  }

  /** @param {EchoSpyPairingState} state */
  async function saveState(state) {
    state.updatedAt = new Date().toISOString();
    state.lanHosts = getLanHosts();
    state.httpPort = DEFAULT_PAIR_HTTP_PORT;
    state.echoNodeId = await getNodeId();
    cached = state;
    await fs.mkdir(path.dirname(statePath()), { recursive: true });
    await fs.writeFile(statePath(), JSON.stringify(state, null, 2), "utf8");
  }

  async function refreshEchoSpyPairCodes() {
    const state = await loadState();
    state.echoSpyActive = true;
    const takenPins = new Set();
    state.mirageCode = createCodeSession(takenPins);
    state.powerfistCode = createCodeSession(takenPins);
    await saveState(state);
    return state;
  }

  async function getEchoSpyPairingStatus() {
    let state = await loadState();
    state.echoSpyActive = true;
    const takenPins = new Set();

    if (!state.mirageCode || sessionExpired(state.mirageCode)) {
      if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
        state = await refreshEchoSpyPairCodes();
      } else {
        if (state.powerfistCode.pin) takenPins.add(state.powerfistCode.pin);
        state.mirageCode = createCodeSession(takenPins);
        await saveState(state);
      }
    } else if (!state.powerfistCode || sessionExpired(state.powerfistCode)) {
      if (state.mirageCode.pin) takenPins.add(state.mirageCode.pin);
      state.powerfistCode = createCodeSession(takenPins);
      await saveState(state);
    }

    const host = state.lanHosts[0] || "127.0.0.1";
    const mirageSession = normalizeStoredSession(state.mirageCode);
    const powerfistSession = normalizeStoredSession(state.powerfistCode);
    const mirageActive = mirageSession && !sessionExpired(mirageSession);
    const powerfistActive = powerfistSession && !sessionExpired(powerfistSession);

    return {
      echoNodeId: state.echoNodeId,
      echoHost: host,
      httpPort: state.httpPort,
      miragePin: mirageActive ? mirageSession.pin : null,
      powerfistPin: powerfistActive ? powerfistSession.pin : null,
      mirageExpiresAt: mirageActive ? mirageSession.expiresAt : null,
      powerfistExpiresAt: powerfistActive ? powerfistSession.expiresAt : null,
      pairedMirage: state.pairedMirage,
      pairedPowerfist: state.pairedPowerfist,
      echoSpyActive: state.echoSpyActive,
      sessionEpoch: state.sessionEpoch,
    };
  }

  /**
   * @param {{ pin: string, role: SpyPairRole, nodeId?: string, deviceId?: string }} input
   */
  async function completeSpyPairEnterByPin(input) {
    const pin = input.pin.trim();
    if (!new RegExp(`^\\d{${SPY_PAIR_PIN_LENGTH}}$`).test(pin)) {
      return { ok: false, reason: `Enter the ${SPY_PAIR_PIN_LENGTH}-digit code from Echo.` };
    }

    const state = await loadState();
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
   * @param {{ pairId: string, pairSecret: string, role: SpyPairRole, nodeId?: string, deviceId?: string }} input
   */
  async function completeSpyPairEnter(input) {
    const state = await loadState();
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
      const mirageToken = state.pairedMirage?.mirageToken ?? crypto.randomBytes(24).toString("hex");
      state.pairedMirage = { nodeId, mirageToken, pairedAt: new Date().toISOString() };
      state.mirageCode = null;
      await saveState(state);
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
    state.pairedPowerfist = { deviceId, remoteToken, pairedAt: new Date().toISOString() };
    state.powerfistCode = null;
    await saveState(state);
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

  /**
   * @param {{ echoNodeId: string, role: SpyPairRole, sessionEpoch: number, nodeId?: string, deviceId?: string }} input
   */
  async function checkEchoSpyLinkStatus(input) {
    const state = await loadState();
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

  return {
    getEchoSpyPairingStatus,
    refreshEchoSpyPairCodes,
    completeSpyPairEnterByPin,
    completeSpyPairEnter,
    checkEchoSpyLinkStatus,
  };
}
