export type HealthCategory =
  | "PROVIDER_ERROR"
  | "AUTH_ERROR"
  | "NETWORK_ERROR"
  | "EXECUTION_LOOP_ERROR"
  | "TOOL_ERROR"
  | "EDITOR_CONTEXT_ERROR"
  | "INTENT_ROUTING_ERROR"
  | "BROWSER_ERROR";

export type HealthStatus = "healthy" | "degraded" | "failed" | "unknown";

export type ProviderHealth = {
  status: HealthStatus;
  provider: string | null;
  model: string | null;
  connected: boolean;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  failureCount: number;
  lastError: string | null;
};

export type ExecutionLoopHealth = {
  status: HealthStatus;
  state: "idle" | "running" | "paused" | "stopped" | "waiting";
  activeJobId: string | null;
  activeToolName: string | null;
  activeSince: number | null;
  lastIdleAt: number | null;
  lastError: string | null;
};

export type EditorContextHealth = {
  status: HealthStatus;
  active: boolean;
  fileName: string | null;
  filePath: string | null;
  language: string | null;
  dirty: boolean;
  lastUpdatedAt: number | null;
};

export type BrowserContextHealth = {
  status: HealthStatus;
  connected: boolean;
  currentUrl: string | null;
  currentTitle: string | null;
};

export type IntentRouterHealth = {
  status: HealthStatus;
  lastPrompt: string | null;
  chosenAction: string | null;
  confidence: number | null;
  fallbackUsed: boolean;
};

export type LastFailure = {
  timestamp: number;
  category: HealthCategory;
  message: string;
  stackTrace: string | null;
};

export type MuthurHealthState = {
  provider: ProviderHealth;
  executionLoop: ExecutionLoopHealth;
  editorContext: EditorContextHealth;
  browserContext: BrowserContextHealth;
  intentRouter: IntentRouterHealth;
  lastFailure: LastFailure | null;
  overallStatus: HealthStatus;
};