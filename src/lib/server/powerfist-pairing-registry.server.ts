// SERVER ONLY — QR pairing sessions and single-device remote tokens.

import crypto from "node:crypto";
import { resolveHttpPort } from "@/lib/server/is-localhost-request.server";
import {
  readPowerfistPairingState,
  writePowerfistPairingState,
  type PowerfistPairingState,
  type PowerfistPairedRemote,
  type PowerfistPairedCapture,
  type PowerfistPairedMirage,
} from "@/lib/server/powerfist-pairing-state.server";
import type { PowerfistMissionEnvelope } from "@/lib/cyberdeck/powerfist-mission.types";
import { ESPIONAGE_SILENT_CAPTURE_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { ESPIONAGE_ECHO_NODE_LABEL } from "@/lib/cyberdeck/espionage-mode";

const PAIRING_TTL_MS = 10 * 60 * 1000;

const REGISTRY_KEY = "__echoMiragePowerfistPairingRegistry";

type PairResult =
  | {
      ok: true;
      remoteToken: string;
      deviceId: string;
      wsHost: string;
      wsPort: number;
    }
  | { ok: false; reason: string };

function registryStore(): { state: PowerfistPairingState | null } {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: { state: PowerfistPairingState | null };
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = { state: null };
  }
  return globalStore[REGISTRY_KEY];
}

export async function loadPowerfistPairingRegistry(): Promise<PowerfistPairingState | null> {
  const store = registryStore();
  if (store.state) return store.state;
  store.state = await readPowerfistPairingState();
  return store.state;
}

export async function savePowerfistPairingRegistry(state: PowerfistPairingState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  registryStore().state = state;
  await writePowerfistPairingState(state);
}

function pairingSessionExpired(state: PowerfistPairingState): boolean {
  const session = state.pairingSession;
  if (!session) return true;
  return Date.parse(session.expiresAt) <= Date.now();
}

function previewPairUrl(state: PowerfistPairingState): string | null {
  const session = state.pairingSession;
  if (!session || pairingSessionExpired(state)) return null;
  const host = state.lanHosts[0] || "127.0.0.1";
  const httpPort = state.httpPort ?? resolveHttpPort();
  const params = new URLSearchParams({
    pairId: session.pairId,
    pairSecret: session.pairSecret,
  });
  return `http://${host}:${httpPort}/preview?${params.toString()}`;
}

export async function createPowerfistQrSession(): Promise<{
  ok: true;
  previewUrl: string;
  expiresAt: string;
  pairedRemote: PowerfistPairedRemote | null;
}> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    throw new Error("PowerFist relay is not running.");
  }

  state.pairingSession = {
    pairId: crypto.randomUUID(),
    pairSecret: crypto.randomBytes(18).toString("base64url"),
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
  state.httpPort = state.httpPort ?? resolveHttpPort();
  await savePowerfistPairingRegistry(state);

  const previewUrl = previewPairUrl(state);
  if (!previewUrl) {
    throw new Error("Failed to build pairing URL.");
  }

  return {
    ok: true,
    previewUrl,
    expiresAt: state.pairingSession.expiresAt,
    pairedRemote: state.pairedRemote ?? null,
  };
}

export async function unpairPowerfistRemote(): Promise<void> {
  const state = await loadPowerfistPairingRegistry();
  if (!state) return;
  state.pairedRemote = null;
  state.pairingSession = null;
  await savePowerfistPairingRegistry(state);
}

export async function completePowerfistPair(input: {
  pairId: string;
  pairSecret: string;
  deviceId: string;
}): Promise<PairResult> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return { ok: false, reason: "PowerFist relay is not running on this deck." };
  }

  const session = state.pairingSession;
  if (!session || pairingSessionExpired(state)) {
    return { ok: false, reason: "Pairing QR expired. Generate a new code on the desktop." };
  }

  if (session.pairId !== input.pairId || session.pairSecret !== input.pairSecret) {
    return { ok: false, reason: "Invalid pairing code." };
  }

  if (
    state.pairedRemote &&
    state.pairedRemote.deviceId !== input.deviceId
  ) {
    return {
      ok: false,
      reason: "Another phone is already paired. Unpair from desktop Settings first.",
    };
  }

  const remoteToken = state.pairedRemote?.remoteToken ?? crypto.randomBytes(32).toString("hex");
  state.pairedRemote = {
    deviceId: input.deviceId,
    remoteToken,
    pairedAt: new Date().toISOString(),
  };
  state.pairingSession = null;
  await savePowerfistPairingRegistry(state);

  return {
    ok: true,
    remoteToken,
    deviceId: input.deviceId,
    wsHost: state.lanHosts[0] || "127.0.0.1",
    wsPort: state.port,
  };
}

export function validatePowerfistDeckToken(state: PowerfistPairingState | null, token: string): boolean {
  if (!state?.deckToken) return false;
  return token === state.deckToken;
}

export function validatePowerfistRemoteToken(
  state: PowerfistPairingState | null,
  token: string,
  deviceId: string,
): boolean {
  const paired = state?.pairedRemote;
  if (!paired) return false;
  return paired.remoteToken === token && paired.deviceId === deviceId;
}

export async function getPowerfistPairingStatus(): Promise<{
  ok: boolean;
  relayRunning: boolean;
  paired: boolean;
  pairedAt?: string;
  deviceId?: string;
  qrActive: boolean;
  qrExpiresAt?: string;
}> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return { ok: true, relayRunning: false, paired: false, qrActive: false };
  }

  const qrActive = Boolean(state.pairingSession && !pairingSessionExpired(state));
  return {
    ok: true,
    relayRunning: true,
    paired: Boolean(state.pairedRemote),
    pairedAt: state.pairedRemote?.pairedAt,
    deviceId: state.pairedRemote?.deviceId,
    qrActive,
    qrExpiresAt: qrActive ? state.pairingSession?.expiresAt : undefined,
  };
}

export async function getPowerfistDeckConnectInfo(): Promise<{
  ok: boolean;
  deckWsUrl?: string;
  wsPort?: number;
  lanHosts?: string[];
  reason?: string;
}> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return { ok: false, reason: "PowerFist relay is not running." };
  }

  const host = state.lanHosts[0] || "127.0.0.1";
  const wsBase = `ws://127.0.0.1:${state.port}`;
  const deckWsUrl = `${wsBase}?role=deck&token=${encodeURIComponent(state.deckToken)}`;

  return {
    ok: true,
    deckWsUrl,
    wsPort: state.port,
    lanHosts: state.lanHosts,
  };
}

function capturePairingSessionExpired(state: PowerfistPairingState): boolean {
  const session = state.capturePairingSession;
  if (!session) return true;
  return Date.parse(session.expiresAt) <= Date.now();
}

function ensureMirageNode(state: PowerfistPairingState): PowerfistPairedMirage {
  if (state.mirageNode?.nodeId) return state.mirageNode;
  return {
    nodeId: crypto.randomUUID(),
    pairedAt: new Date().toISOString(),
  };
}

function buildCapturePairUrl(state: PowerfistPairingState, pairId: string, pairSecret: string): string {
  const host = state.lanHosts[0] || "127.0.0.1";
  const httpPort = state.httpPort ?? resolveHttpPort();
  const params = new URLSearchParams({ pairId, pairSecret });
  return `http://${host}:${httpPort}/powerfist/capture-pair?${params.toString()}`;
}

function capturePairUrl(state: PowerfistPairingState): string | null {
  const session = state.capturePairingSession;
  if (!session || capturePairingSessionExpired(state)) return null;
  return buildCapturePairUrl(state, session.pairId, session.pairSecret);
}

export async function ensurePowerfistMissionSecret(state: PowerfistPairingState): Promise<string> {
  if (state.missionSecret?.trim()) return state.missionSecret.trim();
  state.missionSecret = crypto.randomBytes(24).toString("hex");
  await savePowerfistPairingRegistry(state);
  return state.missionSecret;
}

export async function createPowerfistCaptureQrSession(): Promise<{
  ok: true;
  capturePairUrl: string;
  expiresAt: string;
  pairedCapture: PowerfistPairedCapture | null;
}> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    throw new Error("PowerFist relay is not running.");
  }

  state.mirageNode = ensureMirageNode(state);
  state.capturePairingSession = {
    pairId: crypto.randomUUID(),
    pairSecret: crypto.randomBytes(18).toString("base64url"),
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  };
  await ensurePowerfistMissionSecret(state);
  state.httpPort = state.httpPort ?? resolveHttpPort();
  await savePowerfistPairingRegistry(state);

  const url = capturePairUrl(state);
  if (!url) throw new Error("Failed to build capture pair URL.");

  return {
    ok: true,
    capturePairUrl: url,
    expiresAt: state.capturePairingSession.expiresAt,
    pairedCapture: state.pairedCapture ?? null,
  };
}

export async function unpairPowerfistCapture(): Promise<void> {
  const state = await loadPowerfistPairingRegistry();
  if (!state) return;
  state.pairedCapture = null;
  state.capturePairingSession = null;
  await savePowerfistPairingRegistry(state);
}

export async function completePowerfistCapturePair(input: {
  pairId: string;
  pairSecret: string;
  nodeId: string;
  label?: string;
}): Promise<
  | { ok: true; captureToken: string; nodeId: string; wsHost: string; wsPort: number }
  | { ok: false; reason: string }
> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return { ok: false, reason: "Mirage hub relay is not running." };
  }

  const session = state.capturePairingSession;
  if (!session || capturePairingSessionExpired(state)) {
    return { ok: false, reason: "Echo QR expired. Generate a new code on Mirage." };
  }

  if (session.pairId !== input.pairId || session.pairSecret !== input.pairSecret) {
    return { ok: false, reason: "Invalid Echo pairing code." };
  }

  const captureToken =
    state.pairedCapture?.captureToken ?? crypto.randomBytes(32).toString("hex");
  state.pairedCapture = {
    nodeId: input.nodeId,
    captureToken,
    pairedAt: new Date().toISOString(),
    label: input.label?.trim() || ESPIONAGE_ECHO_NODE_LABEL,
  };
  state.mirageNode = ensureMirageNode(state);
  state.capturePairingSession = null;
  await savePowerfistPairingRegistry(state);

  return {
    ok: true,
    captureToken,
    nodeId: input.nodeId,
    wsHost: state.lanHosts[0] || "127.0.0.1",
    wsPort: state.port,
  };
}

export function validatePowerfistCaptureToken(
  state: PowerfistPairingState | null,
  token: string,
  nodeId: string,
): boolean {
  const paired = state?.pairedCapture;
  if (!paired) return false;
  return paired.captureToken === token && paired.nodeId === nodeId;
}

export function buildMissionIngestUrl(state: PowerfistPairingState): string {
  const host = state.lanHosts[0] || "127.0.0.1";
  const httpPort = state.httpPort ?? resolveHttpPort();
  return `http://${host}:${httpPort}/api/powerfist/mission/ingest`;
}

export async function buildSilentCaptureMissionEnvelope(): Promise<
  | { ok: true; envelope: PowerfistMissionEnvelope }
  | { ok: false; reason: string }
> {
  const state = await loadPowerfistPairingRegistry();
  if (!state?.deckToken) {
    return { ok: false, reason: "Mirage hub is offline." };
  }
  if (!state.pairedCapture) {
    return { ok: false, reason: "Echo is not paired. Scan Echo QR on the screenshot computer." };
  }
  if (!state.pairedRemote) {
    return { ok: false, reason: "PowerFist phone is not paired." };
  }

  const missionSecret = await ensurePowerfistMissionSecret(state);
  const missionId = crypto.randomUUID();
  state.mirageNode = ensureMirageNode(state);
  await savePowerfistPairingRegistry(state);

  return {
    ok: true,
    envelope: {
      type: "mission",
      missionId,
      kind: "silent-capture-solve",
      ingestUrl: buildMissionIngestUrl(state),
      missionSecret,
      prompt: ESPIONAGE_SILENT_CAPTURE_PROMPT,
    },
  };
}

export async function getPowerfistQrSessionForDesktop(): Promise<{
  ok: true;
  previewUrl: string | null;
  expiresAt: string | null;
  pairedRemote: PowerfistPairedRemote | null;
  capturePairUrl: string | null;
  captureExpiresAt: string | null;
  pairedCapture: PowerfistPairedCapture | null;
  mirageNode: PowerfistPairedMirage | null;
}> {
  const state = await loadPowerfistPairingRegistry();
  if (!state) {
    return {
      ok: true,
      previewUrl: null,
      expiresAt: null,
      pairedRemote: null,
      capturePairUrl: null,
      captureExpiresAt: null,
      pairedCapture: null,
      mirageNode: null,
    };
  }

  if (state.deckToken && !state.mirageNode?.nodeId) {
    state.mirageNode = ensureMirageNode(state);
    await savePowerfistPairingRegistry(state);
  }

  const phoneExpired = !state.pairingSession || pairingSessionExpired(state);
  const captureExpired = !state.capturePairingSession || capturePairingSessionExpired(state);

  return {
    ok: true,
    previewUrl: phoneExpired ? null : previewPairUrl(state),
    expiresAt: phoneExpired ? null : state.pairingSession?.expiresAt ?? null,
    pairedRemote: state.pairedRemote ?? null,
    capturePairUrl: captureExpired ? null : capturePairUrl(state),
    captureExpiresAt: captureExpired ? null : state.capturePairingSession?.expiresAt ?? null,
    pairedCapture: state.pairedCapture ?? null,
    mirageNode: state.mirageNode ?? null,
  };
}
