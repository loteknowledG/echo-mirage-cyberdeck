// SERVER ONLY — durable in-memory cadre workforce event log.

import { buildCadreEvent, type CadreEvent, type CadreEventInput } from "@/lib/cadre/cadre-events";

const MAX_EVENTS = 200;

let events: CadreEvent[] = [];

export function appendCadreEventLog(input: CadreEventInput): CadreEvent {
  const event = buildCadreEvent(input);
  events = events.length >= MAX_EVENTS ? [...events.slice(-(MAX_EVENTS - 1)), event] : [...events, event];
  return event;
}

export function listCadreEvents(limit = 100): CadreEvent[] {
  const bounded = Math.max(1, Math.min(200, limit));
  return events.slice(-bounded);
}

export function resetCadreEventLogForTests(): void {
  events = [];
}
