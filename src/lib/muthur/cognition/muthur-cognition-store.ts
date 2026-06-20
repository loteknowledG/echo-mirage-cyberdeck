"use client";

import type {
  MuthurCognitionEvent,
  MuthurCognitionMode,
  MuthurCognitionState,
  MuthurCognitionStreamEntry,
} from "@/lib/muthur/cognition/muthur-cognition-types";

export const MUTHUR_COGNITION_STORAGE_KEY = "echo-mirage-muthur-cognition-v1";

export const MUTHUR_COGNITION_MAX_EVENTS = 120;
export const MUTHUR_COGNITION_MAX_STREAM = 60;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function normalizeMode(value: unknown): MuthurCognitionMode {
  if (value === "off" || value === "summary" || value === "live") return value;
  return "off";
}

function normalizeEvent(raw: unknown): MuthurCognitionEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurCognitionEvent>;
  const category = item.category;
  if (
    category !== "observe" &&
    category !== "retrieve" &&
    category !== "synthesize" &&
    category !== "recommend" &&
    category !== "reflect" &&
    category !== "pattern" &&
    category !== "warning" &&
    category !== "mission" &&
    category !== "memory"
  ) {
    return null;
  }
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.message !== "string" || !item.message.trim()) return null;
  if (typeof item.createdAt !== "string") return null;
  return {
    id: item.id.trim(),
    category,
    message: item.message.trim(),
    createdAt: item.createdAt,
    missionId: typeof item.missionId === "string" ? item.missionId : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
  };
}

function normalizeStreamEntry(raw: unknown): MuthurCognitionStreamEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurCognitionStreamEntry>;
  if (item.kind !== "live" && item.kind !== "summary") return null;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.text !== "string" || !item.text.trim()) return null;
  if (typeof item.createdAt !== "string") return null;
  return {
    id: item.id.trim(),
    kind: item.kind,
    text: item.text.trim(),
    createdAt: item.createdAt,
  };
}

function normalizeState(raw: unknown): MuthurCognitionState | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurCognitionState>;
  if (!Array.isArray(item.events) || !Array.isArray(item.stream)) return null;
  const events = item.events
    .map((entry) => normalizeEvent(entry))
    .filter((entry): entry is MuthurCognitionEvent => Boolean(entry));
  const stream = item.stream
    .map((entry) => normalizeStreamEntry(entry))
    .filter((entry): entry is MuthurCognitionStreamEntry => Boolean(entry));
  const pendingSummary = Array.isArray(item.pendingSummary)
    ? item.pendingSummary
        .map((entry) => normalizeEvent(entry))
        .filter((entry): entry is MuthurCognitionEvent => Boolean(entry))
    : [];
  return {
    mode: normalizeMode(item.mode),
    events,
    stream,
    pendingSummary,
  };
}

export function createEmptyMuthurCognitionState(): MuthurCognitionState {
  return {
    mode: "off",
    events: [],
    stream: [],
    pendingSummary: [],
  };
}

export function loadMuthurCognition(): MuthurCognitionState {
  if (typeof window === "undefined") return createEmptyMuthurCognitionState();
  try {
    const stored = window.localStorage.getItem(MUTHUR_COGNITION_STORAGE_KEY);
    if (!stored) return createEmptyMuthurCognitionState();
    return normalizeState(JSON.parse(stored)) ?? createEmptyMuthurCognitionState();
  } catch {
    return createEmptyMuthurCognitionState();
  }
}

export function saveMuthurCognition(state: MuthurCognitionState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_COGNITION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function createMuthurCognitionEventId(): string {
  return newId("cog");
}

export function createMuthurCognitionStreamEntryId(): string {
  return newId("cog-stream");
}

export function stampMuthurCognitionNow(): string {
  return nowIso();
}
