"use client";

import { emitSignal } from "@/lib/cyberdeck/signal-router";
import {
  buildCadreEvent,
  formatCadreMuthurArchiveLine,
  isCadreEvent,
  type CadreEvent,
  type CadreEventInput,
} from "@/lib/cadre/cadre-events";

export const CADRE_MUTHUR_ARCHIVE_EVENT = "echo-mirage:cadre-muthur-archive";

const MAX_BUFFER = 120;

const ARCHIVED_IDS_STORAGE_KEY = "echo-mirage-cadre-archived-ids-v1";

type CadreEventListener = (event: CadreEvent) => void;

let buffer: CadreEvent[] = [];
const listeners = new Set<CadreEventListener>();
const seenIds = new Set<string>();
const archivedIds = new Set<string>();

function loadArchivedIds() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(ARCHIVED_IDS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === "string") archivedIds.add(id);
    }
  } catch {
    /* ignore */
  }
}

function persistArchivedId(id: string) {
  archivedIds.add(id);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ARCHIVED_IDS_STORAGE_KEY, JSON.stringify([...archivedIds].slice(-200)));
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  loadArchivedIds();
}

function pruneSeenIds() {
  if (seenIds.size <= MAX_BUFFER * 2) return;
  for (const event of buffer) {
    seenIds.delete(event.id);
  }
  for (const event of buffer) {
    seenIds.add(event.id);
  }
}

function notifyListeners(event: CadreEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* listener failures must not break bus */
    }
  }
}

function archiveToMuthur(event: CadreEvent) {
  if (!event.archive || typeof window === "undefined") return;
  if (archivedIds.has(event.id)) return;
  persistArchivedId(event.id);
  window.dispatchEvent(
    new CustomEvent(CADRE_MUTHUR_ARCHIVE_EVENT, {
      detail: { text: formatCadreMuthurArchiveLine(event), event },
    }),
  );
}

function bridgeToDeckSignal(event: CadreEvent) {
  emitSignal({
    source: "cadre",
    type: event.type,
    severity: event.severity,
    payload: {
      actor: event.actor,
      message: event.message,
      runtimeId: event.runtimeId ?? null,
      assignment: event.assignment ?? null,
      verification: event.verification ?? null,
      archive: event.archive,
      eventId: event.id,
      ts: event.ts,
      ...(event.meta ?? {}),
    },
  });
}

/** Ingest a cadre event into the client bus (deduped by id). */
export function ingestCadreEvent(input: CadreEvent | CadreEventInput): CadreEvent {
  const event = isCadreEvent(input) ? input : buildCadreEvent(input);
  if (seenIds.has(event.id)) return event;

  seenIds.add(event.id);
  pruneSeenIds();
  buffer = buffer.length >= MAX_BUFFER ? [...buffer.slice(-(MAX_BUFFER - 1)), event] : [...buffer, event];
  bridgeToDeckSignal(event);
  archiveToMuthur(event);
  notifyListeners(event);
  return event;
}

export function getCadreEventBuffer(): CadreEvent[] {
  return buffer;
}

export function subscribeCadreEvents(listener: CadreEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetCadreEventBusForTests(): void {
  buffer = [];
  seenIds.clear();
  archivedIds.clear();
  listeners.clear();
}
