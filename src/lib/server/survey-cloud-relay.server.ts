// SERVER ONLY — Vercel cloud relay for Survey pairing (Echo push, Mirage pull).

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { resolveEchoTmpPath } from "@/lib/server/echo-runtime-paths.server";

const REGISTRY_KEY = "__echoMirageSurveyCloudRelay";
const BUNDLE_TTL_SEC = 15 * 60;
const LISTENING_TTL_SEC = 10 * 60;
const REQUEST_TTL_SEC = 5 * 60;
const RESULT_TTL_SEC = 10 * 60;

export type SurveyRelayBundle = {
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  miragePin: string;
  powerfistPin: string | null;
  sessionEpoch: number;
  echoSurveyActive: boolean;
  sentAt: string;
  expiresAt: string;
};

export type SurveyRelayPairRequest = {
  requestId: string;
  echoNodeId: string;
  role: "mirage" | "powerfist";
  pin: string;
  nodeId?: string;
  deviceId?: string;
  createdAt: string;
  status: "pending" | "complete" | "failed";
};

export type SurveyRelayPairResult = {
  requestId: string;
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
  completedAt: string;
};

/** Async Echo command over cloud relay (screenshot, clipboard, etc.). */
export type SurveyRelayCommandRequest = {
  requestId: string;
  echoNodeId: string;
  action: string;
  tabId?: number;
  payload?: {
    prompt?: string;
    pngBase64?: string;
    pngBase64List?: string[];
  };
  nodeId?: string;
  createdAt: string;
  status: "pending" | "complete" | "failed";
};

export type SurveyRelayCommandResult = {
  requestId: string;
  ok: boolean;
  action?: string;
  message?: string;
  reason?: string;
  answerText?: string;
  provider?: string;
  model?: string;
  pngBase64?: string;
  clipboard?: { text?: string; hasImage?: boolean; formats?: string[] };
  width?: number;
  height?: number;
  completedAt: string;
};

export type SurveyRelayListeningFinal = {
  text: string;
  at: string;
  seq: number;
};

/** Latest Echo listening / STT snapshot for Mirage poll. */
export type SurveyRelayListeningSnapshot = {
  echoNodeId: string;
  listening: boolean;
  kind: "started" | "stopped" | "partial" | "final" | "error";
  interim: string;
  lastFinal: string;
  finals: SurveyRelayListeningFinal[];
  seq: number;
  error: string | null;
  updatedAt: string;
  expiresAt: string;
};

type RelayStore = {
  bundles: Record<string, SurveyRelayBundle>;
  /** Most recently pushed Echo team id — Mirage can recover from a stale saved id. */
  activeEchoNodeId?: string | null;
  listening: Record<string, SurveyRelayListeningSnapshot>;
  requests: Record<string, SurveyRelayPairRequest>;
  results: Record<string, SurveyRelayPairResult>;
  requestIdsByEcho: Record<string, string[]>;
  commandRequests: Record<string, SurveyRelayCommandRequest>;
  commandResults: Record<string, SurveyRelayCommandResult>;
  commandIdsByEcho: Record<string, string[]>;
};

const ACTIVE_ECHO_KEY = "survey:relay:active-echo-node";

function relayStatePath(): string {
  const fromEnv = process.env.ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH?.trim();
  if (fromEnv) return fromEnv;
  return resolveEchoTmpPath("survey-cloud-relay.json");
}

function memoryStore(): RelayStore {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: RelayStore;
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = {
      bundles: {},
      activeEchoNodeId: null,
      listening: {},
      requests: {},
      results: {},
      requestIdsByEcho: {},
      commandRequests: {},
      commandResults: {},
      commandIdsByEcho: {},
    };
  }
  const store = globalStore[REGISTRY_KEY];
  store.listening ??= {};
  store.commandRequests ??= {};
  store.commandResults ??= {};
  store.commandIdsByEcho ??= {};
  store.bundles ??= {};
  store.activeEchoNodeId ??= null;
  store.requests ??= {};
  store.results ??= {};
  store.requestIdsByEcho ??= {};
  return store;
}

async function readFileStore(): Promise<RelayStore> {
  const cached = memoryStore();
  try {
    const raw = await fs.readFile(relayStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<RelayStore>;
    const fromDisk: RelayStore = {
      bundles: parsed.bundles ?? {},
      activeEchoNodeId: parsed.activeEchoNodeId ?? null,
      listening: parsed.listening ?? {},
      requests: parsed.requests ?? {},
      results: parsed.results ?? {},
      requestIdsByEcho: parsed.requestIdsByEcho ?? {},
      commandRequests: parsed.commandRequests ?? {},
      commandResults: parsed.commandResults ?? {},
      commandIdsByEcho: parsed.commandIdsByEcho ?? {},
    };
    // Prefer disk as source of truth, keep memory in sync for same isolate.
    const globalStore = globalThis as typeof globalThis & {
      [REGISTRY_KEY]?: RelayStore;
    };
    globalStore[REGISTRY_KEY] = fromDisk;
    return fromDisk;
  } catch {
    return cached;
  }
}

async function writeFileStore(store: RelayStore): Promise<void> {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: RelayStore;
  };
  // Always keep in-memory copy — required when disk is not durable/writable.
  globalStore[REGISTRY_KEY] = store;
  try {
    const filePath = relayStatePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Ignore FS errors (e.g. rare Vercel edge cases); memory still holds the update.
  }
}

function upstashConfigured(): boolean {
  return Boolean(upstashRestUrl() && upstashRestToken());
}

function upstashRestUrl(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    null
  );
}

function upstashRestToken(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    null
  );
}

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = upstashRestUrl();
  const token = upstashRestToken();
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured.");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash request failed (${res.status}).`);
  }
  const payload = (await res.json()) as { result?: unknown };
  return payload.result;
}

async function upstashGetJson<T>(key: string): Promise<T | null> {
  const raw = await upstashCommand(["GET", key]);
  if (typeof raw !== "string" || !raw.trim()) return null;
  return JSON.parse(raw) as T;
}

async function upstashSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  await upstashCommand(["SET", key, JSON.stringify(value), "EX", ttlSec]);
}

async function upstashDel(key: string): Promise<void> {
  await upstashCommand(["DEL", key]);
}

async function upstashGetString(key: string): Promise<string | null> {
  const raw = await upstashCommand(["GET", key]);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function upstashSetString(key: string, value: string, ttlSec: number): Promise<void> {
  await upstashCommand(["SET", key, value, "EX", ttlSec]);
}

function bundleKey(echoNodeId: string): string {
  return `survey:relay:bundle:${echoNodeId}`;
}

async function saveActiveEchoNodeId(echoNodeId: string): Promise<void> {
  const id = echoNodeId.trim();
  if (!id) return;
  if (upstashConfigured()) {
    await upstashSetString(ACTIVE_ECHO_KEY, id, BUNDLE_TTL_SEC);
    return;
  }
  const store = await readFileStore();
  store.activeEchoNodeId = id;
  await writeFileStore(store);
}

async function readActiveEchoNodeId(): Promise<string | null> {
  if (upstashConfigured()) {
    return upstashGetString(ACTIVE_ECHO_KEY);
  }
  const store = await readFileStore();
  pruneStore(store);
  const id = store.activeEchoNodeId?.trim() || null;
  if (!id) return null;
  const bundle = store.bundles[id];
  if (!bundle || Date.parse(bundle.expiresAt) <= Date.now()) {
    store.activeEchoNodeId = null;
    await writeFileStore(store);
    return null;
  }
  return id;
}

function requestKey(requestId: string): string {
  return `survey:relay:request:${requestId}`;
}

function resultKey(requestId: string): string {
  return `survey:relay:result:${requestId}`;
}

function pendingListKey(echoNodeId: string): string {
  return `survey:relay:pending:${echoNodeId}`;
}

function commandRequestKey(requestId: string): string {
  return `survey:relay:command-request:${requestId}`;
}

function commandResultKey(requestId: string): string {
  return `survey:relay:command-result:${requestId}`;
}

function commandPendingListKey(echoNodeId: string): string {
  return `survey:relay:command-pending:${echoNodeId}`;
}

function listeningKey(echoNodeId: string): string {
  return `survey:relay:listening:${echoNodeId}`;
}

function pruneStore(store: RelayStore): void {
  const now = Date.now();
  for (const [id, bundle] of Object.entries(store.bundles)) {
    if (Date.parse(bundle.expiresAt) <= now) delete store.bundles[id];
  }
  for (const [id, snap] of Object.entries(store.listening ?? {})) {
    if (Date.parse(snap.expiresAt) <= now) delete store.listening[id];
  }
  for (const [id, request] of Object.entries(store.requests)) {
    if (request.status !== "pending") continue;
    if (Date.parse(request.createdAt) + REQUEST_TTL_SEC * 1000 <= now) {
      delete store.requests[id];
    }
  }
  for (const [id, request] of Object.entries(store.commandRequests)) {
    if (request.status !== "pending") continue;
    if (Date.parse(request.createdAt) + REQUEST_TTL_SEC * 1000 <= now) {
      delete store.commandRequests[id];
    }
  }
}

export function surveyRelaySecret(): string | null {
  return process.env.SURVEY_RELAY_SECRET?.trim() || null;
}

export function verifySurveyRelaySecret(header: string | null): boolean {
  const secret = surveyRelaySecret();
  if (!secret) return true;
  if (!header?.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (provided.length !== secret.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function surveyRelayStorageMode(): "upstash" | "file" {
  return upstashConfigured() ? "upstash" : "file";
}

export async function saveSurveyRelayBundle(
  bundle: Omit<SurveyRelayBundle, "sentAt" | "expiresAt"> & {
    sentAt?: string;
    expiresAt?: string;
  },
): Promise<SurveyRelayBundle> {
  const sentAt = bundle.sentAt ?? new Date().toISOString();
  const expiresAt =
    bundle.expiresAt ?? new Date(Date.now() + BUNDLE_TTL_SEC * 1000).toISOString();
  const record: SurveyRelayBundle = {
    ...bundle,
    sentAt,
    expiresAt,
  };

  if (upstashConfigured()) {
    await upstashSetJson(bundleKey(bundle.echoNodeId), record, BUNDLE_TTL_SEC);
    await saveActiveEchoNodeId(bundle.echoNodeId);
    return record;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.bundles[bundle.echoNodeId] = record;
  store.activeEchoNodeId = bundle.echoNodeId;
  await writeFileStore(store);
  return record;
}

export async function loadSurveyRelayBundle(
  echoNodeId: string,
): Promise<SurveyRelayBundle | null> {
  const id = echoNodeId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    const record = await upstashGetJson<SurveyRelayBundle>(bundleKey(id));
    if (!record) return null;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await upstashDel(bundleKey(id));
      return null;
    }
    return record;
  }

  const store = await readFileStore();
  pruneStore(store);
  const record = store.bundles[id] ?? null;
  if (!record) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    delete store.bundles[id];
    await writeFileStore(store);
    return null;
  }
  return record;
}

/** Most recently pushed Echo bundle (survives Mirage saving a stale team id). */
export async function loadActiveSurveyRelayBundle(): Promise<SurveyRelayBundle | null> {
  const activeId = await readActiveEchoNodeId();
  if (!activeId) return null;
  return loadSurveyRelayBundle(activeId);
}

/**
 * Prefer the caller's team id when a live bundle exists; otherwise use the active Echo.
 */
export async function resolveSurveyRelayBundle(
  preferredEchoNodeId?: string | null,
): Promise<{ bundle: SurveyRelayBundle; source: "preferred" | "active" } | null> {
  const preferred = preferredEchoNodeId?.trim() || "";
  if (preferred) {
    const exact = await loadSurveyRelayBundle(preferred);
    if (exact) return { bundle: exact, source: "preferred" };
  }
  const active = await loadActiveSurveyRelayBundle();
  if (active) return { bundle: active, source: "active" };
  return null;
}

export async function saveSurveyRelayListeningSnapshot(input: {
  echoNodeId: string;
  kind: SurveyRelayListeningSnapshot["kind"];
  listening?: boolean;
  interim?: string;
  final?: string;
  text?: string;
  seq?: number;
  error?: string | null;
  finals?: SurveyRelayListeningFinal[];
}): Promise<SurveyRelayListeningSnapshot> {
  const echoNodeId = input.echoNodeId.trim();
  const previous = (await loadSurveyRelayListeningSnapshot(echoNodeId)) ?? null;
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LISTENING_TTL_SEC * 1000).toISOString();
  const lastFinal =
    (typeof input.final === "string" && input.final.trim()) ||
    (input.kind === "final" && typeof input.text === "string" ? input.text.trim() : "") ||
    previous?.lastFinal ||
    "";
  const finals =
    Array.isArray(input.finals) && input.finals.length > 0
      ? input.finals.slice(-12)
      : previous?.finals ?? [];
  if (input.kind === "final" && lastFinal) {
    const seq = typeof input.seq === "number" ? input.seq : (previous?.seq ?? 0) + 1;
    const already = finals.some((f) => f.seq === seq && f.text === lastFinal);
    if (!already) {
      finals.push({ text: lastFinal, at: updatedAt, seq });
    }
  }

  const record: SurveyRelayListeningSnapshot = {
    echoNodeId,
    listening: typeof input.listening === "boolean" ? input.listening : previous?.listening ?? false,
    kind: input.kind,
    interim: typeof input.interim === "string" ? input.interim : previous?.interim ?? "",
    lastFinal,
    finals: finals.slice(-12),
    seq: typeof input.seq === "number" ? input.seq : previous?.seq ?? 0,
    error: typeof input.error === "string" ? input.error : input.error === null ? null : previous?.error ?? null,
    updatedAt,
    expiresAt,
  };

  if (upstashConfigured()) {
    await upstashSetJson(listeningKey(echoNodeId), record, LISTENING_TTL_SEC);
    return record;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.listening ??= {};
  store.listening[echoNodeId] = record;
  await writeFileStore(store);
  return record;
}

export async function loadSurveyRelayListeningSnapshot(
  echoNodeId: string,
): Promise<SurveyRelayListeningSnapshot | null> {
  const id = echoNodeId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    const record = await upstashGetJson<SurveyRelayListeningSnapshot>(listeningKey(id));
    if (!record) return null;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await upstashDel(listeningKey(id));
      return null;
    }
    return record;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.listening ??= {};
  const record = store.listening[id] ?? null;
  if (!record) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    delete store.listening[id];
    await writeFileStore(store);
    return null;
  }
  return record;
}

export async function resolveSurveyRelayListeningSnapshot(
  preferredEchoNodeId?: string | null,
): Promise<{ listening: SurveyRelayListeningSnapshot; source: "preferred" | "active" } | null> {
  const preferred = preferredEchoNodeId?.trim() || "";
  if (preferred) {
    const exact = await loadSurveyRelayListeningSnapshot(preferred);
    if (exact) return { listening: exact, source: "preferred" };
  }
  const activeId = await readActiveEchoNodeId();
  if (activeId) {
    const active = await loadSurveyRelayListeningSnapshot(activeId);
    if (active) return { listening: active, source: "active" };
  }
  return null;
}

export async function createSurveyRelayPairRequest(input: {
  echoNodeId: string;
  role: "mirage" | "powerfist";
  pin: string;
  nodeId?: string;
  deviceId?: string;
}): Promise<SurveyRelayPairRequest> {
  const requestId = crypto.randomUUID();
  const request: SurveyRelayPairRequest = {
    requestId,
    echoNodeId: input.echoNodeId.trim(),
    role: input.role,
    pin: input.pin.trim(),
    nodeId: input.nodeId?.trim() || undefined,
    deviceId: input.deviceId?.trim() || undefined,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  if (upstashConfigured()) {
    await upstashSetJson(requestKey(requestId), request, REQUEST_TTL_SEC);
    const list =
      (await upstashGetJson<string[]>(pendingListKey(request.echoNodeId))) ?? [];
    if (!list.includes(requestId)) {
      list.push(requestId);
    }
    await upstashSetJson(pendingListKey(request.echoNodeId), list, REQUEST_TTL_SEC);
    return request;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.requests[requestId] = request;
  const ids = store.requestIdsByEcho[request.echoNodeId] ?? [];
  if (!ids.includes(requestId)) ids.push(requestId);
  store.requestIdsByEcho[request.echoNodeId] = ids;
  await writeFileStore(store);
  return request;
}

export async function listPendingSurveyRelayPairRequests(
  echoNodeId: string,
): Promise<SurveyRelayPairRequest[]> {
  const id = echoNodeId.trim();
  if (!id) return [];

  if (upstashConfigured()) {
    const list = (await upstashGetJson<string[]>(pendingListKey(id))) ?? [];
    const requests: SurveyRelayPairRequest[] = [];
    for (const requestId of list) {
      const request = await upstashGetJson<SurveyRelayPairRequest>(requestKey(requestId));
      if (!request || request.status !== "pending") continue;
      requests.push(request);
    }
    return requests;
  }

  const store = await readFileStore();
  pruneStore(store);
  const ids = store.requestIdsByEcho[id] ?? [];
  return ids
    .map((requestId) => store.requests[requestId])
    .filter((request): request is SurveyRelayPairRequest => Boolean(request && request.status === "pending"));
}

export async function saveSurveyRelayPairResult(
  result: SurveyRelayPairResult,
  echoNodeId: string,
): Promise<void> {
  if (upstashConfigured()) {
    await upstashSetJson(resultKey(result.requestId), result, RESULT_TTL_SEC);
    const request = await upstashGetJson<SurveyRelayPairRequest>(requestKey(result.requestId));
    if (request) {
      request.status = result.ok ? "complete" : "failed";
      await upstashSetJson(requestKey(result.requestId), request, REQUEST_TTL_SEC);
    }
    const list = (await upstashGetJson<string[]>(pendingListKey(echoNodeId))) ?? [];
    const next = list.filter((id) => id !== result.requestId);
    await upstashSetJson(pendingListKey(echoNodeId), next, REQUEST_TTL_SEC);
    return;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.results[result.requestId] = result;
  const request = store.requests[result.requestId];
  if (request) {
    request.status = result.ok ? "complete" : "failed";
  }
  const ids = store.requestIdsByEcho[echoNodeId] ?? [];
  store.requestIdsByEcho[echoNodeId] = ids.filter((entry) => entry !== result.requestId);
  await writeFileStore(store);
}

export async function loadSurveyRelayPairResult(
  requestId: string,
): Promise<SurveyRelayPairResult | null> {
  const id = requestId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    return upstashGetJson<SurveyRelayPairResult>(resultKey(id));
  }

  const store = await readFileStore();
  return store.results[id] ?? null;
}

export async function loadSurveyRelayPairRequest(
  requestId: string,
): Promise<SurveyRelayPairRequest | null> {
  const id = requestId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    return upstashGetJson<SurveyRelayPairRequest>(requestKey(id));
  }

  const store = await readFileStore();
  return store.requests[id] ?? null;
}

export async function createSurveyRelayCommandRequest(input: {
  echoNodeId: string;
  action: string;
  tabId?: number;
  payload?: {
    prompt?: string;
    pngBase64?: string;
    pngBase64List?: string[];
  };
  nodeId?: string;
}): Promise<SurveyRelayCommandRequest> {
  const requestId = crypto.randomUUID();
  const request: SurveyRelayCommandRequest = {
    requestId,
    echoNodeId: input.echoNodeId.trim(),
    action: input.action.trim(),
    tabId: Number.isFinite(input.tabId) ? input.tabId : undefined,
    payload: input.payload,
    nodeId: input.nodeId?.trim() || undefined,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  if (upstashConfigured()) {
    await upstashSetJson(commandRequestKey(requestId), request, REQUEST_TTL_SEC);
    const list =
      (await upstashGetJson<string[]>(commandPendingListKey(request.echoNodeId))) ?? [];
    if (!list.includes(requestId)) {
      list.push(requestId);
    }
    await upstashSetJson(commandPendingListKey(request.echoNodeId), list, REQUEST_TTL_SEC);
    return request;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.commandRequests[requestId] = request;
  const ids = store.commandIdsByEcho[request.echoNodeId] ?? [];
  if (!ids.includes(requestId)) ids.push(requestId);
  store.commandIdsByEcho[request.echoNodeId] = ids;
  await writeFileStore(store);
  return request;
}

export async function listPendingSurveyRelayCommandRequests(
  echoNodeId: string,
): Promise<SurveyRelayCommandRequest[]> {
  const id = echoNodeId.trim();
  if (!id) return [];

  if (upstashConfigured()) {
    const list = (await upstashGetJson<string[]>(commandPendingListKey(id))) ?? [];
    const requests: SurveyRelayCommandRequest[] = [];
    for (const requestId of list) {
      const request = await upstashGetJson<SurveyRelayCommandRequest>(
        commandRequestKey(requestId),
      );
      if (!request || request.status !== "pending") continue;
      requests.push(request);
    }
    return requests;
  }

  const store = await readFileStore();
  pruneStore(store);
  const ids = store.commandIdsByEcho[id] ?? [];
  return ids
    .map((requestId) => store.commandRequests[requestId])
    .filter((request): request is SurveyRelayCommandRequest =>
      Boolean(request && request.status === "pending"),
    );
}

export async function saveSurveyRelayCommandResult(
  result: SurveyRelayCommandResult,
  echoNodeId: string,
): Promise<void> {
  if (upstashConfigured()) {
    await upstashSetJson(commandResultKey(result.requestId), result, RESULT_TTL_SEC);
    const request = await upstashGetJson<SurveyRelayCommandRequest>(
      commandRequestKey(result.requestId),
    );
    if (request) {
      request.status = result.ok ? "complete" : "failed";
      await upstashSetJson(commandRequestKey(result.requestId), request, REQUEST_TTL_SEC);
    }
    const list = (await upstashGetJson<string[]>(commandPendingListKey(echoNodeId))) ?? [];
    const next = list.filter((id) => id !== result.requestId);
    await upstashSetJson(commandPendingListKey(echoNodeId), next, REQUEST_TTL_SEC);
    return;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.commandResults[result.requestId] = result;
  const request = store.commandRequests[result.requestId];
  if (request) {
    request.status = result.ok ? "complete" : "failed";
  }
  const ids = store.commandIdsByEcho[echoNodeId] ?? [];
  store.commandIdsByEcho[echoNodeId] = ids.filter((entry) => entry !== result.requestId);
  await writeFileStore(store);
}

export async function loadSurveyRelayCommandResult(
  requestId: string,
): Promise<SurveyRelayCommandResult | null> {
  const id = requestId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    return upstashGetJson<SurveyRelayCommandResult>(commandResultKey(id));
  }

  const store = await readFileStore();
  return store.commandResults[id] ?? null;
}

export async function loadSurveyRelayCommandRequest(
  requestId: string,
): Promise<SurveyRelayCommandRequest | null> {
  const id = requestId.trim();
  if (!id) return null;

  if (upstashConfigured()) {
    return upstashGetJson<SurveyRelayCommandRequest>(commandRequestKey(id));
  }

  const store = await readFileStore();
  return store.commandRequests[id] ?? null;
}
