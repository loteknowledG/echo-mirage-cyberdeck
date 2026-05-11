"use client";

import { useEffect, useState } from "react";
import { emitSignal } from "@/lib/cyberdeck/signal-router";

export type OperatorState =
  | "ONLINE"
  | "THINKING"
  | "INDEXING"
  | "REVIEWING"
  | "IDLE"
  | "ROUTING"
  | "MEMORY_SYNC"
  | "BLOCKED";

export type OperatorStatus = {
  id: string;
  callsign: string;
  role: string;
  state: OperatorState;
  activityText: string;
  lastUpdate: number;
};

type OperatorListener = (operators: OperatorStatus[]) => void;

const ROTATABLE_STATES: OperatorState[] = [
  "ONLINE",
  "THINKING",
  "INDEXING",
  "REVIEWING",
  "IDLE",
  "ROUTING",
  "MEMORY_SYNC",
  "BLOCKED",
];

const ACTIVITY_POOL: Record<string, string[]> = {
  "chatgpt-lead": [
    "ChatGPT :: routing operator chatter...",
    "ChatGPT :: harmonizing deck directives...",
    "ChatGPT :: validating mission intent...",
    "ChatGPT :: broadcasting command posture...",
  ],
  "cursor-dev": [
    "Cursor :: indexing workspace topology...",
    "Cursor :: diffing module surfaces...",
    "Cursor :: staging patch vectors...",
    "Cursor :: reconciling tab state...",
  ],
  "codex-test": [
    "Codex :: validating runtime surfaces...",
    "Codex :: probing SSR boundaries...",
    "Codex :: replaying smoke assertions...",
    "Codex :: checking interaction loops...",
  ],
  "samus-manus-memory": [
    "Samus-Manus :: memory anchor stable...",
    "Samus-Manus :: syncing recall lattice...",
    "Samus-Manus :: indexing flight traces...",
    "Samus-Manus :: preserving mission continuity...",
  ],
};

let listeners = new Set<OperatorListener>();
let operators: OperatorStatus[] = [
  {
    id: "chatgpt-lead",
    callsign: "ChatGPT",
    role: "Lead",
    state: "ONLINE",
    activityText: ACTIVITY_POOL["chatgpt-lead"]![0]!,
    lastUpdate: Date.now(),
  },
  {
    id: "cursor-dev",
    callsign: "Cursor",
    role: "Dev",
    state: "THINKING",
    activityText: ACTIVITY_POOL["cursor-dev"]![0]!,
    lastUpdate: Date.now(),
  },
  {
    id: "codex-test",
    callsign: "Codex",
    role: "Test",
    state: "REVIEWING",
    activityText: ACTIVITY_POOL["codex-test"]![0]!,
    lastUpdate: Date.now(),
  },
  {
    id: "samus-manus-memory",
    callsign: "Samus-Manus",
    role: "Memory",
    state: "MEMORY_SYNC",
    activityText: ACTIVITY_POOL["samus-manus-memory"]![0]!,
    lastUpdate: Date.now(),
  },
];

let runtimeStarted = false;
let runtimeIntervals: number[] = [];

function emit() {
  for (const listener of listeners) {
    listener(operators);
  }
}

function pickRandom<T>(items: T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

function advanceOperator(operatorId: string) {
  const now = Date.now();
  operators = operators.map((operator) => {
    if (operator.id !== operatorId) return operator;
    const nextState = pickRandom(ROTATABLE_STATES, operator.state);
    const pool = ACTIVITY_POOL[operator.id] ?? [];
    const activityText = pickRandom(pool, operator.activityText);
    const next = {
      ...operator,
      state: nextState,
      activityText,
      lastUpdate: now,
    };
    emitSignal({
      source: "operators",
      type: "activity",
      payload: {
        callsign: operator.callsign,
        action: activityText.replace(/^.+::\s*/, "").replace(/\.\.\.$/, ""),
        state: nextState,
      },
      severity: nextState === "BLOCKED" ? "warning" : "info",
    });
    return next;
  });
  emit();
}

function ensureRuntime() {
  if (runtimeStarted) return;
  if (typeof window === "undefined") return;
  runtimeStarted = true;
  runtimeIntervals = operators.map((operator, index) =>
    window.setInterval(
      () => advanceOperator(operator.id),
      4000 + ((index * 997 + Math.floor(Math.random() * 5000)) % 5000),
    ),
  );
}

export function subscribeOperators(listener: OperatorListener) {
  listeners.add(listener);
  listener(operators);
  ensureRuntime();
  return () => {
    listeners.delete(listener);
  };
}

export function useOperators() {
  const [snapshot, setSnapshot] = useState<OperatorStatus[]>(() => operators);
  useEffect(() => subscribeOperators(setSnapshot), []);
  const stateCounts = snapshot.reduce<Record<"ONLINE" | "THINKING" | "IDLE", number>>(
    (acc, operator) => {
      if (operator.state === "ONLINE") acc.ONLINE += 1;
      if (operator.state === "THINKING") acc.THINKING += 1;
      if (operator.state === "IDLE") acc.IDLE += 1;
      return acc;
    },
    { ONLINE: 0, THINKING: 0, IDLE: 0 },
  );
  return {
    operators: snapshot,
    operatorCount: snapshot.length,
    stateCounts,
  };
}
