"use client";

import { subscribeSignals, type DeckSignal, type SignalSeverity } from "@/lib/cyberdeck/signal-router";

export type FlightLogSeverity = SignalSeverity;

export type FlightLogEntry = {
  id: string;
  at: number | null;
  actor: string;
  action: string;
  result: string;
  severity?: FlightLogSeverity;
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
let signalBridgeStarted = false;
const MIN_ENTRY_GAP_MS = 1000;
const SYNTHETIC_MIN_MS = 6000;
const SYNTHETIC_MAX_MS = 14000;
const SYNTHETIC_EVENTS = [
  { actor: "DECK", action: "ambient telemetry nominal", result: "OK" },
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
    severity: entry.severity,
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

function readString(payload: Record<string, unknown> | undefined, key: string): string | null {
  if (!payload) return null;
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function actorFromCallsign(callsign: string): string {
  const primary = callsign.split("//")[0]?.trim() || callsign;
  return primary.toUpperCase();
}

function formatModuleLabel(target: string): string {
  if (target === "memory-atlas") return "Memory Atlas";
  if (target === "flight-log") return "Flight Log";
  if (target === "voice-lab") return "Voice Lab";
  if (target === "catalog") return "Catalog";
  if (target === "operators") return "Operators";
  if (target === "settings") return "Settings";
  if (target === "command") return "Command";
  return target;
}

/**
 * Translate a DeckSignal into the actor/action/result shape used by the flight log.
 * Returns null for signals that should not surface in the formatted log (e.g. UI clicks).
 */
export function signalToFlightLog(
  signal: DeckSignal,
): Omit<FlightLogEntry, "id" | "at"> | null {
  const severity = signal.severity ?? "info";
  const payload = signal.payload;

  switch (`${signal.source}:${signal.type}`) {
    case "command:submitted": {
      const text = readString(payload, "text") ?? "(empty)";
      return { actor: "COMMAND", action: text.toLowerCase(), result: "QUEUED", severity };
    }
    case "command:cleared": {
      return { actor: "COMMAND", action: "buffer cleared", result: "OK", severity };
    }
    case "catalog:model_selected": {
      const label = readString(payload, "label") ?? "unknown";
      return { actor: "CATALOG", action: "model selected", result: label, severity };
    }
    case "catalog:model_configured": {
      const label = readString(payload, "label") ?? "unknown";
      return { actor: "CATALOG", action: "model configured", result: label, severity };
    }
    case "operators:operator_selected": {
      const callsign = readString(payload, "callsign") ?? "unknown";
      return { actor: "OPERATORS", action: "active operator changed", result: callsign, severity };
    }
    case "operators:acknowledged": {
      const callsign = readString(payload, "callsign") ?? "OPERATOR";
      const text = readString(payload, "text") ?? "acknowledged";
      return {
        actor: callsign.toUpperCase(),
        action: text,
        result: "ACK",
        severity,
      };
    }
    case "operators:activity": {
      const callsign = readString(payload, "callsign") ?? "OPERATOR";
      const action = readString(payload, "action") ?? "activity";
      const state = readString(payload, "state") ?? "OK";
      return { actor: callsign.toUpperCase(), action, result: state, severity };
    }
    case "operators:reaction": {
      const callsign = readString(payload, "callsign") ?? "OPERATOR";
      const action = readString(payload, "action") ?? "acknowledged";
      const ref = readString(payload, "ref");
      return {
        actor: actorFromCallsign(callsign),
        action,
        result: ref ? "SUCCESS" : "ACK",
        severity,
      };
    }
    case "atlas:entity_selected": {
      const label = readString(payload, "label") ?? "unknown";
      return { actor: "ATLAS", action: "entity selected", result: label, severity };
    }
    case "settings:updated": {
      const key = readString(payload, "key") ?? "value";
      const rawValue = payload?.["value"];
      const value =
        rawValue === null || rawValue === undefined
          ? "—"
          : typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue);
      return { actor: "SETTINGS", action: `updated :: ${key}`, result: value, severity };
    }
    case "system:mode_changed": {
      const mode = readString(payload, "mode") ?? "unknown";
      return { actor: "SYSTEM", action: "deck mode changed", result: mode, severity };
    }
    case "system:navigate": {
      const target = readString(payload, "target") ?? "unknown";
      return { actor: "SYSTEM", action: "navigate", result: target, severity };
    }
    case "system:module_focus_requested": {
      const target = readString(payload, "target") ?? "unknown";
      return { actor: "SYSTEM", action: "module focus requested", result: formatModuleLabel(target), severity };
    }
    case "system:focused_module": {
      const target = readString(payload, "target") ?? "unknown";
      return { actor: "SYSTEM", action: "focused module", result: formatModuleLabel(target), severity };
    }
    case "system:navigate_recommendation": {
      const target = readString(payload, "target") ?? "unknown";
      return { actor: "SYSTEM", action: "navigate recommendation", result: formatModuleLabel(target), severity };
    }
    case "system:orchestrator_dropped": {
      const reason = readString(payload, "reason") ?? "unknown";
      return { actor: "SYSTEM", action: "orchestrator drop", result: reason, severity };
    }
    case "system:boot_line": {
      const actor = readString(payload, "actor") ?? "BOOT";
      const action = readString(payload, "action") ?? "progress";
      const result = readString(payload, "result") ?? "OK";
      return { actor, action, result, severity };
    }
    case "audio:setting_changed": {
      const key = readString(payload, "key") ?? "audio";
      const rawValue = payload?.["value"];
      const value =
        rawValue === null || rawValue === undefined
          ? "—"
          : typeof rawValue === "string"
            ? rawValue
            : typeof rawValue === "boolean"
              ? rawValue ? "ON" : "OFF"
              : JSON.stringify(rawValue);
      return { actor: "AUDIO", action: `setting :: ${key}`, result: value, severity };
    }
    case "voice:lab_action": {
      const action = readString(payload, "action") ?? "voice";
      const detail = readString(payload, "detail") ?? "OK";
      return { actor: "VOICE", action, result: detail, severity };
    }
    case "health:provider_connected": {
      const provider = payload?.["metadata"] ? (payload.metadata as { provider?: string }).provider : readString(payload, "reason");
      return { actor: "PROVIDER", action: "connected", result: provider ? `// ${provider.toUpperCase()}` : "OK", severity: "success" };
    }
    case "health:provider_disconnected": {
      const reason = readString(payload, "reason");
      return { actor: "PROVIDER", action: "disconnected", result: reason ?? "LINK_DROPPED", severity: "warning" };
    }
    case "health:provider_failure": {
      const reason = readString(payload, "reason") ?? "UNKNOWN";
      return { actor: "PROVIDER", action: "failure", result: reason, severity: "error" };
    }
    case "health:loop_state_change": {
      const from = readString(payload, "fromStatus") ?? "—";
      const to = readString(payload, "toStatus") ?? "—";
      return { actor: "LOOP", action: "state change", result: `${from} → ${to}`, severity };
    }
    case "health:loop_timeout": {
      const reason = readString(payload, "reason") ?? "TIMEOUT";
      return { actor: "LOOP", action: "timeout", result: reason, severity: "error" };
    }
    case "health:loop_recovered": {
      const from = readString(payload, "fromStatus") ?? "—";
      return { actor: "LOOP", action: "recovered", result: `from: ${from}`, severity: "success" };
    }
    case "health:editor_context_connected": {
      const file = readString(payload, "reason") ?? "—";
      return { actor: "EDITOR", action: "connected", result: file, severity: "success" };
    }
    case "health:editor_context_disconnected": {
      return { actor: "EDITOR", action: "disconnected", result: "LINK_DROPPED", severity: "warning" };
    }
    case "health:editor_context_failure": {
      const reason = readString(payload, "reason") ?? "UNKNOWN";
      return { actor: "EDITOR", action: "failure", result: reason, severity: "error" };
    }
    case "health:browser_connected": {
      const url = readString(payload, "reason") ?? "—";
      return { actor: "BROWSER", action: "connected", result: url, severity: "success" };
    }
    case "health:browser_disconnected": {
      const url = readString(payload, "reason") ?? "—";
      return { actor: "BROWSER", action: "disconnected", result: url, severity: "warning" };
    }
    case "health:browser_failure": {
      const reason = readString(payload, "reason") ?? "UNKNOWN";
      return { actor: "BROWSER", action: "failure", result: reason, severity: "error" };
    }
    case "health:intent_routing_fallback": {
      const action = payload?.["metadata"] ? (payload.metadata as { chosenAction?: string }).chosenAction : readString(payload, "reason");
      return { actor: "INTENT", action: "fallback activated", result: action ?? "LOCAL_MODE", severity: "warning" };
    }
    case "health:intent_routing_failure": {
      const reason = readString(payload, "reason") ?? "UNKNOWN";
      return { actor: "INTENT", action: "failure", result: reason, severity: "error" };
    }
    case "health:failure_recorded": {
      const category = payload?.["metadata"] ? (payload.metadata as { category?: string }).category : readString(payload, "reason");
      return { actor: "HEALTH", action: "failure logged", result: category ?? "UNKNOWN", severity: "error" };
    }
    case "health:health_status_change": {
      const from = readString(payload, "fromStatus") ?? "—";
      const to = readString(payload, "toStatus") ?? "—";
      const reason = readString(payload, "reason");
      return { actor: "HEALTH", action: `status change ${from} → ${to}`, result: reason ?? "—", severity };
    }
    case "cadre:runtime_started":
    case "cadre:runtime_stopped":
    case "cadre:verification_pass":
    case "cadre:verification_fail":
    case "cadre:readiness_changed":
    case "cadre:host_error":
    case "cadre:host_ready": {
      const actor = readString(payload, "actor") ?? "CADRE";
      const message = readString(payload, "message") ?? signal.type;
      return { actor, action: message, result: signal.type.replace(/^cadre:/, "").toUpperCase(), severity };
    }
    default:
      return null;
  }
}

function ensureSignalBridge() {
  if (signalBridgeStarted) return;
  if (typeof window === "undefined") return;
  signalBridgeStarted = true;
  subscribeSignals((signal) => {
    const mapped = signalToFlightLog(signal);
    if (!mapped) return;
    appendFlightLog(mapped);
  });
}

if (typeof window !== "undefined") {
  scheduleSyntheticEntry();
  ensureSignalBridge();
}
