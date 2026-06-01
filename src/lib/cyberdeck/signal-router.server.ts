import type { SignalSource, SignalSeverity, HealthSignalType, HealthSignalPayload } from "./signal-router";

export type { SignalSource, SignalSeverity, HealthSignalType, HealthSignalPayload };

export interface DeckSignal {
  id: string;
  ts: string;
  source: SignalSource;
  type: string;
  payload?: Record<string, unknown>;
  severity?: SignalSeverity;
}

type SignalListener = (signal: DeckSignal) => void;

const MAX_BUFFER = 200;

const listeners = new Set<SignalListener>();
let ringBuffer: DeckSignal[] = [];
let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `signal-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function emitSignal(
  signal: Omit<DeckSignal, "id" | "ts"> & { ts?: string },
): DeckSignal {
  const finalized: DeckSignal = {
    id: generateId(),
    ts: signal.ts ?? new Date().toISOString(),
    source: signal.source,
    type: signal.type,
    payload: signal.payload,
    severity: signal.severity ?? "info",
  };
  ringBuffer = ringBuffer.length >= MAX_BUFFER
    ? [...ringBuffer.slice(ringBuffer.length - MAX_BUFFER + 1), finalized]
    : [...ringBuffer, finalized];
  for (const listener of listeners) {
    try {
      listener(finalized);
    } catch {
      /* listener failures must not break emission */
    }
  }
  return finalized;
}

export function subscribeSignals(listener: SignalListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSignalHistory(limit?: number): DeckSignal[] {
  if (typeof limit !== "number" || limit <= 0) return [...ringBuffer];
  if (limit >= ringBuffer.length) return [...ringBuffer];
  return ringBuffer.slice(ringBuffer.length - limit);
}

export function clearSignalHistory(): void {
  ringBuffer = [];
}

export function emitHealthSignal(
  type: HealthSignalType,
  payload?: HealthSignalPayload,
  severity?: SignalSeverity,
): DeckSignal {
  return emitSignal({
    source: "health",
    type,
    payload: payload as Record<string, unknown> | undefined,
    severity: severity ?? (type.includes("failure") || type === "provider_failure" ? "error" : type.includes("recovered") || type === "provider_connected" ? "success" : "info"),
  });
}