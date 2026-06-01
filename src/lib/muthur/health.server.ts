import type { HealthCategory, HealthStatus, ProviderHealth, ExecutionLoopHealth, EditorContextHealth, BrowserContextHealth, IntentRouterHealth, LastFailure, MuthurHealthState } from "./health.types";

const DEFAULT_HEALTH: MuthurHealthState = {
  provider: {
    status: "unknown",
    provider: null,
    model: null,
    connected: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    failureCount: 0,
    lastError: null,
  },
  executionLoop: {
    status: "unknown",
    state: "idle",
    activeJobId: null,
    activeToolName: null,
    activeSince: null,
    lastIdleAt: null,
    lastError: null,
  },
  editorContext: {
    status: "unknown",
    active: false,
    fileName: null,
    filePath: null,
    language: null,
    dirty: false,
    lastUpdatedAt: null,
  },
  browserContext: {
    status: "unknown",
    connected: false,
    currentUrl: null,
    currentTitle: null,
  },
  intentRouter: {
    status: "unknown",
    lastPrompt: null,
    chosenAction: null,
    confidence: null,
    fallbackUsed: false,
  },
  lastFailure: null,
  overallStatus: "unknown",
};

let healthState: MuthurHealthState = { ...DEFAULT_HEALTH };

const listeners = new Set<(state: MuthurHealthState) => void>();

function computeOverallStatus(state: MuthurHealthState): HealthStatus {
  const statuses = [
    state.provider.status,
    state.executionLoop.status,
    state.editorContext.status,
    state.browserContext.status,
    state.intentRouter.status,
  ];
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  if (statuses.every((s) => s === "healthy")) return "healthy";
  return "unknown";
}

function emit(): void {
  healthState = { ...healthState, overallStatus: computeOverallStatus(healthState) };
  listeners.forEach((fn) => fn(healthState));
}

export function getHealthState(): MuthurHealthState {
  return { ...healthState, overallStatus: computeOverallStatus(healthState) };
}

export function subscribeHealth(listener: (state: MuthurHealthState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordProviderHealth(update: Partial<ProviderHealth>): void {
  const prev = healthState.provider;
  healthState = {
    ...healthState,
    provider: { ...prev, ...update },
  };
  if (update.status === "healthy") {
    healthState.provider.lastSuccessAt = Date.now();
  } else if (update.status === "failed") {
    healthState.provider.lastFailureAt = Date.now();
    healthState.provider.failureCount = prev.failureCount + 1;
    recordFailure("PROVIDER_ERROR", update.lastError ?? "Provider failure");
  }
  emit();
}

export function recordExecutionLoopHealth(update: Partial<ExecutionLoopHealth>): void {
  const prev = healthState.executionLoop;
  healthState = {
    ...healthState,
    executionLoop: { ...prev, ...update },
  };
  if (update.state === "idle" && prev.state !== "idle") {
    healthState.executionLoop.lastIdleAt = Date.now();
  }
  if (update.status === "failed") {
    recordFailure("EXECUTION_LOOP_ERROR", update.lastError ?? "Execution loop error");
  }
  emit();
}

export function recordEditorContextHealth(update: Partial<EditorContextHealth>): void {
  const prev = healthState.editorContext;
  healthState = {
    ...healthState,
    editorContext: { ...prev, ...update },
  };
  if (update.status === "failed") {
    recordFailure("EDITOR_CONTEXT_ERROR", "Editor context error");
  }
  emit();
}

export function recordBrowserContextHealth(update: Partial<BrowserContextHealth>): void {
  const prev = healthState.browserContext;
  healthState = {
    ...healthState,
    browserContext: { ...prev, ...update },
  };
  if (update.status === "failed") {
    recordFailure("BROWSER_ERROR", "Browser context error");
  }
  emit();
}

export function recordIntentRouterHealth(update: Partial<IntentRouterHealth>): void {
  const prev = healthState.intentRouter;
  healthState = {
    ...healthState,
    intentRouter: { ...prev, ...update },
  };
  if (update.status === "failed" && prev.status !== "failed") {
    recordFailure("INTENT_ROUTING_ERROR", "Intent routing failure");
  }
  emit();
}

export function recordFailure(category: HealthCategory, message: string, stackTrace?: string): void {
  healthState = {
    ...healthState,
    lastFailure: {
      timestamp: Date.now(),
      category,
      message,
      stackTrace: stackTrace ?? null,
    },
  };
  emit();
}

export function resetHealth(): void {
  healthState = { ...DEFAULT_HEALTH };
  emit();
}

export function formatHealthStatus(status: HealthStatus): string {
  switch (status) {
    case "healthy": return "HEALTHY";
    case "degraded": return "DEGRADED";
    case "failed": return "FAILED";
    default: return "UNKNOWN";
  }
}

export function getHealthEmoji(status: HealthStatus): string {
  switch (status) {
    case "healthy": return "🟢";
    case "degraded": return "🟡";
    case "failed": return "🔴";
    default: return "⚪";
  }
}