import { emitSignal } from "@/lib/cyberdeck/signal-router";
import type { TunesEvent, TunesEventType } from "@/lib/tunes/types";

type TunesEventListener = (event: TunesEvent) => void;

const listeners = new Set<TunesEventListener>();
const MAX_BUFFER = 80;
let buffer: TunesEvent[] = [];

export function emitTunesEvent(type: TunesEventType, payload?: Record<string, unknown>): TunesEvent {
  const event: TunesEvent = {
    type,
    at: new Date().toISOString(),
    payload,
  };
  buffer = [event, ...buffer].slice(0, MAX_BUFFER);
  for (const listener of listeners) {
    listener(event);
  }
  emitSignal({
    source: "system",
    type: "tunes_event",
    payload: { tunesEvent: type, ...payload },
    severity: type === "provider_error" ? "warning" : "info",
  });
  return event;
}

export function subscribeTunesEvents(listener: TunesEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTunesEventBuffer(): readonly TunesEvent[] {
  return buffer;
}
