// SERVER ONLY — Call Station waiting-room registry (file or Upstash).

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type {
  CallStationRole,
  CallStationRoom,
  CallStationStore,
} from "@/lib/call-station/types";

const REGISTRY_KEY = "__echoMirageCallStationRooms";
const UPSTASH_KEY = "call-station:rooms";
const ROOM_TTL_MS = 30 * 60 * 1000;
const ROOM_TTL_SEC = 30 * 60;

function statePath(): string {
  return (
    process.env.ECHO_MIRAGE_CALL_STATION_STATE_PATH?.trim() ||
    path.join(process.cwd(), ".tmp", "call-station-rooms.json")
  );
}

function emptyStore(): CallStationStore {
  return { rooms: {} };
}

function memoryStore(): CallStationStore {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: CallStationStore;
  };
  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = emptyStore();
  }
  return globalStore[REGISTRY_KEY];
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
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
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`);
  }
  const payload = (await res.json()) as { result?: unknown };
  return payload.result;
}

async function readFileStore(): Promise<CallStationStore> {
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<CallStationStore>;
    return { rooms: parsed.rooms ?? {} };
  } catch {
    return memoryStore();
  }
}

async function writeFileStore(store: CallStationStore): Promise<void> {
  const filePath = statePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: CallStationStore;
  };
  globalStore[REGISTRY_KEY] = store;
}

async function loadStore(): Promise<CallStationStore> {
  if (upstashConfigured()) {
    try {
      const raw = await upstashCommand(["GET", UPSTASH_KEY]);
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw) as Partial<CallStationStore>;
        return { rooms: parsed.rooms ?? {} };
      }
    } catch {
      /* fall through */
    }
    return emptyStore();
  }
  return readFileStore();
}

async function saveStore(store: CallStationStore): Promise<void> {
  if (upstashConfigured()) {
    await upstashCommand(["SET", UPSTASH_KEY, JSON.stringify(store), "EX", ROOM_TTL_SEC]);
    return;
  }
  await writeFileStore(store);
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function isExpired(room: CallStationRoom, now = Date.now()): boolean {
  return new Date(room.expiresAt).getTime() <= now;
}

function prune(store: CallStationStore, now = Date.now()): CallStationStore {
  const rooms: Record<string, CallStationRoom> = {};
  for (const [id, room] of Object.entries(store.rooms)) {
    if (isExpired(room, now)) {
      rooms[id] = { ...room, status: "expired" };
      continue;
    }
    rooms[id] = room;
  }
  return { rooms };
}

function rolesCompatible(waitingAs: CallStationRole, lookingFor: CallStationRole): boolean {
  if (lookingFor === "any" || waitingAs === "any") return true;
  return waitingAs === lookingFor;
}

export function callStationStorageMode(): "upstash" | "file" {
  return upstashConfigured() ? "upstash" : "file";
}

export async function listWaitingCallStationRooms(options?: {
  lookingFor?: CallStationRole;
}): Promise<CallStationRoom[]> {
  const lookingFor = options?.lookingFor ?? "any";
  const store = prune(await loadStore());
  await saveStore(store);
  const now = Date.now();
  return Object.values(store.rooms)
    .filter((room) => room.status === "waiting" && !isExpired(room, now))
    .filter((room) => rolesCompatible(room.waitingAs, lookingFor))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function openCallStationRoom(input: {
  waitingAs: CallStationRole;
  label?: string;
}): Promise<CallStationRoom> {
  const store = prune(await loadStore());
  const now = Date.now();
  const room: CallStationRoom = {
    roomId: `cs-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    code: makeCode(),
    waitingAs: input.waitingAs,
    label: input.label?.trim() || `${input.waitingAs} waiting`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ROOM_TTL_MS).toISOString(),
    status: "waiting",
  };
  store.rooms[room.roomId] = room;
  await saveStore(store);
  return room;
}

export async function matchCallStationRoom(input: {
  lookingFor: CallStationRole;
  label?: string;
}): Promise<{ matched: CallStationRoom | null; opened?: CallStationRoom; waiting: CallStationRoom[] }> {
  const waiting = await listWaitingCallStationRooms({ lookingFor: input.lookingFor });
  const best = waiting[0] ?? null;
  if (!best) {
    const opened = await openCallStationRoom({
      waitingAs: input.lookingFor === "any" ? "any" : input.lookingFor,
      label: input.label,
    });
    return { matched: null, opened, waiting: [] };
  }

  const store = prune(await loadStore());
  const room = store.rooms[best.roomId];
  if (!room || room.status !== "waiting") {
    return { matched: null, waiting };
  }
  room.status = "matched";
  room.matchedAt = new Date().toISOString();
  store.rooms[room.roomId] = room;
  await saveStore(store);
  return { matched: room, waiting: waiting.slice(1) };
}

export async function getCallStationRoom(roomIdOrCode: string): Promise<CallStationRoom | null> {
  const key = roomIdOrCode.trim();
  if (!key) return null;
  const store = prune(await loadStore());
  await saveStore(store);
  const byId = store.rooms[key];
  if (byId && !isExpired(byId)) return byId;
  const upper = key.toUpperCase();
  return (
    Object.values(store.rooms).find(
      (room) => room.code === upper && room.status !== "expired" && !isExpired(room),
    ) ?? null
  );
}
