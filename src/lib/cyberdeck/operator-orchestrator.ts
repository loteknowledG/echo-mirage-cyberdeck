"use client";

import { useEffect } from "react";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { emitSignal, subscribeSignals, type DeckSignal, type SignalSeverity } from "@/lib/cyberdeck/signal-router";
import { pulseOperatorState } from "@/lib/operators";

const MAX_OUTSTANDING_TIMERS = 16;
const COMMAND_DEDUP_MS = 1500;
const ORIGIN_SIGNAL_IDS_MAX = 256;
const DROPPED_WARNING_COOLDOWN_MS = 2500;

type TransientOperatorState = "ROUTING" | "REVIEWING" | "MEMORY_SYNC" | "ACKNOWLEDGED" | "INDEXING";

type CommandRoute = {
  keywords: string[];
  target?: "memory-atlas" | "catalog" | "operators" | "flight-log" | "voice-lab" | "settings";
  responder: string;
  action: string;
};

const commandRoutes: CommandRoute[] = [
  {
    keywords: ["atlas", "memory"],
    target: "memory-atlas",
    responder: "Samus-Manus // Memory",
    action: "topology surface prepared",
  },
  {
    keywords: ["catalog", "craftwerk", "echo"],
    target: "catalog",
    responder: "Cursor // Dev",
    action: "configuration surface prepared",
  },
  {
    keywords: ["operator", "crew"],
    target: "operators",
    responder: "ChatGPT // Lead",
    action: "crew register synced",
  },
  {
    keywords: ["log", "blackbox", "flight"],
    target: "flight-log",
    responder: "Codex // Test",
    action: "recorder bus opened",
  },
  {
    keywords: ["voice", "audio", "muthur"],
    target: "voice-lab",
    responder: "Samus-Manus // Memory",
    action: "vocal pipeline armed",
  },
  {
    keywords: ["settings", "mode", "ascii"],
    target: "settings",
    responder: "ChatGPT // Lead",
    action: "console preferences exposed",
  },
];

type ScheduledChainItem = {
  baseDelayMs: number;
  run: () => void;
};

let isStarted = false;
let activeConsumers = 0;
let unsubscribeSignals: (() => void) | null = null;
const outstandingTimers = new Set<number>();
const orchestratorOriginSignalIds = new Set<string>();
let lastDroppedWarningAt = 0;
const recentCommandByKey = new Map<string, number>();

function randomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function toUpperActor(callsign: string): string {
  const left = callsign.split("//")[0]?.trim() || callsign;
  return left.toUpperCase();
}

function prettyTarget(target: string): string {
  if (target === "memory-atlas") return "Memory Atlas";
  if (target === "flight-log") return "Flight Log";
  if (target === "voice-lab") return "Voice Lab";
  if (target === "catalog") return "Catalog";
  if (target === "operators") return "Operators";
  if (target === "settings") return "Settings";
  if (target === "command") return "Command";
  return target;
}

function rememberOriginSignalId(id: string) {
  orchestratorOriginSignalIds.add(id);
  if (orchestratorOriginSignalIds.size <= ORIGIN_SIGNAL_IDS_MAX) return;
  const oldest = orchestratorOriginSignalIds.values().next().value;
  if (typeof oldest === "string") {
    orchestratorOriginSignalIds.delete(oldest);
  }
}

function getTransientState(action: string): TransientOperatorState {
  const normalized = action.toLowerCase();
  if (normalized.includes("routing")) return "ROUTING";
  if (normalized.includes("resolved")) return "MEMORY_SYNC";
  if (normalized.includes("prepared")) return "REVIEWING";
  if (normalized.includes("verification")) return "INDEXING";
  return "ACKNOWLEDGED";
}

function getSeverity(action: string): SignalSeverity {
  const normalized = action.toLowerCase();
  if (
    normalized.includes("prepared") ||
    normalized.includes("resolved") ||
    normalized.includes("restored") ||
    normalized.includes("synced") ||
    normalized.includes("opened") ||
    normalized.includes("armed") ||
    normalized.includes("active")
  ) {
    return "success";
  }
  return "info";
}

function emitReaction(refSignalId: string, callsign: string, action: string, severity?: SignalSeverity) {
  const next = emitSignal({
    source: "operators",
    type: "reaction",
    payload: {
      callsign,
      action,
      ref: refSignalId,
      orchestrator: true,
    },
    severity: severity ?? getSeverity(action),
  });
  rememberOriginSignalId(next.id);
  pulseOperatorState(callsign, getTransientState(action), 1500);
}

function emitDropWarning(reason: string) {
  const now = Date.now();
  if (now - lastDroppedWarningAt < DROPPED_WARNING_COOLDOWN_MS) return;
  lastDroppedWarningAt = now;
  emitSignal({
    source: "system",
    type: "orchestrator_dropped",
    severity: "warning",
    payload: { reason },
  });
}

function scheduleChain(items: ScheduledChainItem[]) {
  const chain = items.slice(0, 3);
  for (const item of chain) {
    if (outstandingTimers.size >= MAX_OUTSTANDING_TIMERS) {
      emitDropWarning("timer_cap_reached");
      return;
    }
    const jitterMs = randomInt(80, 250);
    const delay = Math.max(200, item.baseDelayMs + jitterMs);
    const timerId = window.setTimeout(() => {
      outstandingTimers.delete(timerId);
      item.run();
    }, delay);
    outstandingTimers.add(timerId);
  }
}

function routeForCommand(text: string): CommandRoute {
  const lowered = text.toLowerCase();
  const matched = commandRoutes.find((route) => route.keywords.some((keyword) => lowered.includes(keyword)));
  if (matched) return matched;
  return {
    keywords: [],
    responder: "ChatGPT // Lead",
    action: "routing analysis nominal",
  };
}

function handleCommandSubmitted(signal: DeckSignal) {
  const text = typeof signal.payload?.["text"] === "string" ? String(signal.payload?.["text"]) : "";
  const normalizedText = text.trim().toLowerCase();
  const dedupKey = `${signal.source}:${signal.type}:${normalizedText}`;
  const now = Date.now();
  const lastSeenAt = recentCommandByKey.get(dedupKey);
  if (typeof lastSeenAt === "number" && now - lastSeenAt < COMMAND_DEDUP_MS) {
    return;
  }
  recentCommandByKey.set(dedupKey, now);
  for (const [key, ts] of recentCommandByKey) {
    if (now - ts > COMMAND_DEDUP_MS) {
      recentCommandByKey.delete(key);
    }
  }

  const route = routeForCommand(normalizedText);
  scheduleChain([
    {
      baseDelayMs: 250,
      run: () => {
        const routingAction = route.target
          ? `routing command :: ${prettyTarget(route.target)}`
          : "routing command";
        emitReaction(signal.id, "ChatGPT // Lead", routingAction, "info");
      },
    },
    {
      baseDelayMs: 600,
      run: () => {
        if (!route.target) return;
        emitSignal({
          source: "system",
          type: "module_focus_requested",
          payload: { target: route.target },
          severity: "info",
        });
      },
    },
    {
      baseDelayMs: 900,
      run: () => {
        emitReaction(signal.id, route.responder, route.action, "success");
      },
    },
  ]);
}

function handleCatalogSelected(signal: DeckSignal) {
  scheduleChain([
    {
      baseDelayMs: randomInt(200, 520),
      run: () => emitReaction(signal.id, "Cursor // Dev", "configuration surface prepared", "success"),
    },
    {
      baseDelayMs: randomInt(520, 900),
      run: () => emitReaction(signal.id, "Codex // Test", "awaiting build verification path", "info"),
    },
  ]);
}

function handleAtlasSelected(signal: DeckSignal) {
  scheduleChain([
    {
      baseDelayMs: randomInt(220, 600),
      run: () => emitReaction(signal.id, "Samus-Manus // Memory", "entity anchor resolved", "success"),
    },
    {
      baseDelayMs: randomInt(560, 980),
      run: () => emitReaction(signal.id, "ChatGPT // Lead", "context linked to command channel", "info"),
    },
  ]);
}

function handleModeChanged(signal: DeckSignal) {
  const mode = typeof signal.payload?.["mode"] === "string" ? signal.payload.mode : "";
  if (mode === "ASCII") {
    scheduleChain([
      {
        baseDelayMs: randomInt(200, 580),
        run: () => emitReaction(signal.id, "system", "emergency interface profile active", "warning"),
      },
      {
        baseDelayMs: randomInt(520, 980),
        run: () => emitReaction(signal.id, "Codex // Test", "layout integrity watch engaged", "info"),
      },
    ]);
    return;
  }
  scheduleChain([
    {
      baseDelayMs: randomInt(240, 700),
      run: () => emitReaction(signal.id, "system", "ambient interface restored", "success"),
    },
  ]);
}

function handleOperatorSelected(signal: DeckSignal) {
  const callsign = typeof signal.payload?.["callsign"] === "string" ? signal.payload.callsign : "";
  if (!callsign.trim()) return;
  scheduleChain([
    {
      baseDelayMs: randomInt(200, 700),
      run: () => emitReaction(signal.id, callsign, "standing by", "info"),
    },
  ]);
}

function handleSystemNavigate(signal: DeckSignal) {
  const target = typeof signal.payload?.["target"] === "string" ? signal.payload.target : "unknown";
  scheduleChain([
    {
      baseDelayMs: randomInt(220, 760),
      run: () => emitReaction(signal.id, "ChatGPT // Lead", `navigation relay ${prettyTarget(target)}`, "info"),
    },
  ]);
}

function handleSignal(signal: DeckSignal) {
  const orchestratorFlag = signal.payload?.["orchestrator"] === true;
  if (
    (signal.source === "operators" && orchestratorFlag) ||
    orchestratorOriginSignalIds.has(signal.id)
  ) {
    return;
  }

  const signature = `${signal.source}:${signal.type}`;
  if (signature === "command:submitted") {
    handleCommandSubmitted(signal);
    return;
  }
  if (signature === "catalog:model_selected") {
    handleCatalogSelected(signal);
    return;
  }
  if (signature === "atlas:entity_selected") {
    handleAtlasSelected(signal);
    return;
  }
  if (signature === "operators:operator_selected") {
    handleOperatorSelected(signal);
    return;
  }
  if (signature === "system:mode_changed") {
    handleModeChanged(signal);
    return;
  }
  if (signature === "system:navigate") {
    handleSystemNavigate(signal);
  }
}

function stopOrchestrator() {
  unsubscribeSignals?.();
  unsubscribeSignals = null;
  isStarted = false;
  for (const timerId of outstandingTimers) {
    window.clearTimeout(timerId);
  }
  outstandingTimers.clear();
}

export function startOperatorOrchestrator(): () => void {
  if (!ENABLE_AUTOMATION) {
    return () => {
      /* manual bridge mode — orchestrator idle */
    };
  }
  if (typeof window === "undefined") {
    return () => {
      /* noop on server */
    };
  }
  activeConsumers += 1;
  if (!isStarted) {
    unsubscribeSignals = subscribeSignals(handleSignal);
    isStarted = true;
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    activeConsumers = Math.max(0, activeConsumers - 1);
    if (activeConsumers === 0) {
      stopOrchestrator();
    }
  };
}

export function useOperatorOrchestrator() {
  useEffect(() => {
    const dispose = startOperatorOrchestrator();
    return dispose;
  }, []);
}
