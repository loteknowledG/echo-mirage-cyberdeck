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
  const next: FlightLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? Date.now(),
    actor: entry.actor,
    action: entry.action,
    result: entry.result,
  };
  entries = [...entries.slice(-249), next];
  emit();
  return next;
}
