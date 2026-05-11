"use client";

import { useEffect, useState } from "react";

export type SignalSource =
  | "command"
  | "catalog"
  | "operators"
  | "atlas"
  | "voice"
  | "audio"
  | "settings"
  | "system"
  | "ui";

export type SignalSeverity = "info" | "success" | "warning" | "error";

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
  const cryptoApi: Crypto | undefined =
    typeof globalThis !== "undefined" && (globalThis as { crypto?: Crypto }).crypto
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    try {
      return cryptoApi.randomUUID();
    } catch {
      /* fall through to counter */
    }
  }
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

/** Subscribe to live deck signals as long as the component is mounted. */
export function useDeckSignal(handler: SignalListener): void {
  useEffect(() => {
    const unsubscribe = subscribeSignals(handler);
    return unsubscribe;
  }, [handler]);
}

/** Reactive view of the last N signals from the ring buffer. */
export function useSignalHistory(limit: number = 20): DeckSignal[] {
  const [snapshot, setSnapshot] = useState<DeckSignal[]>(() => getSignalHistory(limit));
  useEffect(() => {
    setSnapshot(getSignalHistory(limit));
    const unsubscribe = subscribeSignals(() => {
      setSnapshot(getSignalHistory(limit));
    });
    return unsubscribe;
  }, [limit]);
  return snapshot;
}
