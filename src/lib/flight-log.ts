"use client";

export type FlightLogEntry = {
  id: string;
  at: number | null;
  actor: string;
  action: string;
  result: string;
};

type FlightLogListener = (entries: FlightLogEntry[]) => void;

const listeners = new Set<FlightLogListener>();

const seedEntries: FlightLogEntry[] = [
  { id: "seed-1", at: null, actor: "DECK", action: "cold start", result: "SUCCESS" },
  { id: "seed-2", at: null, actor: "CURSOR", action: "bridge online", result: "SUCCESS" },
  { id: "seed-3", at: null, actor: "MUTHUR", action: "memory channel", result: "READY" },
  { id: "seed-4", at: null, actor: "RAIL", action: "tab shell sync", result: "NOMINAL" },
];

let entries: FlightLogEntry[] = [...seedEntries];
let lastEntryAt = 0;
let syntheticTimer: number | null = null;
const MIN_ENTRY_GAP_MS = 1000;
const SYNTHETIC_MIN_MS = 6000;
const SYNTHETIC_MAX_MS = 14000;
const SYNTHETIC_EVENTS = [
  { actor: "DECK", action: "ambient telemetry nominal", result: "OK" },
  { actor: "DECK", action: "scanline drift recalibrated", result: "OK" },
  { actor: "RAIL", action: "bus pulse synchronized", result: "NOMINAL" },
  { actor: "SHELL", action: "surface heartbeat steady", result: "OK" },
];

function emit() {
  for (const listener of listeners) {
    listener(entries);
  }
}

export function getFlightLogEntries() {
  return entries;
}

export function subscribeFlightLog(listener: FlightLogListener) {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export function appendFlightLog(entry: Omit<FlightLogEntry, "id" | "at"> & { at?: number | null }) {
  const now = Date.now();
  if (now - lastEntryAt < MIN_ENTRY_GAP_MS) return null;
  const next: FlightLogEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? now,
    actor: entry.actor,
    action: entry.action,
    result: entry.result,
  };
  lastEntryAt = now;
  entries = [...entries.slice(-249), next];
  emit();
  return next;
}

function syntheticDelay() {
  return SYNTHETIC_MIN_MS + Math.floor(Math.random() * (SYNTHETIC_MAX_MS - SYNTHETIC_MIN_MS + 1));
}

function scheduleSyntheticEntry() {
  if (typeof window === "undefined") return;
  if (syntheticTimer !== null) {
    window.clearTimeout(syntheticTimer);
  }
  syntheticTimer = window.setTimeout(() => {
    const now = Date.now();
    if (now - lastEntryAt >= SYNTHETIC_MIN_MS) {
      const event = SYNTHETIC_EVENTS[Math.floor(Math.random() * SYNTHETIC_EVENTS.length)];
      if (event) {
        appendFlightLog({ ...event, at: now });
      }
    }
    scheduleSyntheticEntry();
  }, syntheticDelay());
}

if (typeof window !== "undefined") {
  scheduleSyntheticEntry();
}
