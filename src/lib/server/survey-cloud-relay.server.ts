// SERVER ONLY — Vercel cloud relay for Survey pairing (Echo push, Mirage pull).

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const REGISTRY_KEY = "__echoMirageSurveyCloudRelay";
const BUNDLE_TTL_SEC = 15 * 60;
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

type RelayStore = {
  bundles: Record<string, SurveyRelayBundle>;
  requests: Record<string, SurveyRelayPairRequest>;
  results: Record<string, SurveyRelayPairResult>;
  requestIdsByEcho: Record<string, string[]>;
};

function relayStatePath(): string {
  return (
    process.env.ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH?.trim() ||
    path.join(process.cwd(), ".tmp", "survey-cloud-relay.json")
  );
}

function memoryStore(): RelayStore {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: RelayStore;
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = {
      bundles: {},
      requests: {},
      results: {},
      requestIdsByEcho: {},
    };
  }
  return globalStore[REGISTRY_KEY];
}

async function readFileStore(): Promise<RelayStore> {
  try {
    const raw = await fs.readFile(relayStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<RelayStore>;
    return {
      bundles: parsed.bundles ?? {},
      requests: parsed.requests ?? {},
      results: parsed.results ?? {},
      requestIdsByEcho: parsed.requestIdsByEcho ?? {},
    };
  } catch {
    return memoryStore();
  }
}

async function writeFileStore(store: RelayStore): Promise<void> {
  const filePath = relayStatePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: RelayStore;
  };
  globalStore[REGISTRY_KEY] = store;
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
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

function bundleKey(echoNodeId: string): string {
  return `survey:relay:bundle:${echoNodeId}`;
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

function pruneStore(store: RelayStore): void {
  const now = Date.now();
  for (const [id, bundle] of Object.entries(store.bundles)) {
    if (Date.parse(bundle.expiresAt) <= now) delete store.bundles[id];
  }
  for (const [id, request] of Object.entries(store.requests)) {
    if (request.status !== "pending") continue;
    if (Date.parse(request.createdAt) + REQUEST_TTL_SEC * 1000 <= now) {
      delete store.requests[id];
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
    return record;
  }

  const store = await readFileStore();
  pruneStore(store);
  store.bundles[bundle.echoNodeId] = record;
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
