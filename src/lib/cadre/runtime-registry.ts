/** Client-safe cadre runtime model and slot registry. */

export const CADRE_TERMINAL_TYPES = ["codex", "cursor", "opencode", "pi"] as const;

export type CadreTerminalType = (typeof CADRE_TERMINAL_TYPES)[number];

export type CadreRuntimeStatus = "starting" | "running" | "stopped";

export type CadreRuntimeReadiness =
  | "unknown"
  | "starting"
  | "blocked_update_prompt"
  | "blocked_auth"
  | "ready"
  | "errored"
  | "stopped";

export type CadreRuntimeAdapterId = "codex-cli" | "stub-host";

export type CadreRuntime = {
  id: string;
  name: string;
  status: CadreRuntimeStatus;
  terminalType: CadreTerminalType;
  startedAt: string | null;
  pid: number | null;
  adapter: CadreRuntimeAdapterId;
  readiness: CadreRuntimeReadiness;
  readinessReason: string;
  lastReadinessAt: string | null;
};

/** Registry row shape for server persistence and diagnostics. */
export type CadreRuntimeRegistryEntry = {
  runtime_id: string;
  agent_name: string;
  status: CadreRuntimeStatus;
  pid: number | null;
  start_time: string | null;
  terminal_type: CadreTerminalType;
};

export type CadreRuntimeSlot = {
  id: CadreTerminalType;
  name: string;
  terminalType: CadreTerminalType;
  adapter: CadreRuntimeAdapterId;
};

export const CADRE_RUNTIME_SLOTS: readonly CadreRuntimeSlot[] = [
  { id: "codex", name: "CODEX", terminalType: "codex", adapter: "codex-cli" },
  { id: "cursor", name: "CURSOR", terminalType: "cursor", adapter: "stub-host" },
  { id: "opencode", name: "OPENCODE", terminalType: "opencode", adapter: "stub-host" },
  { id: "pi", name: "PI", terminalType: "pi", adapter: "stub-host" },
] as const;

export const CADRE_RUNTIME_ADAPTER_BY_TYPE: Record<CadreTerminalType, CadreRuntimeAdapterId> =
  Object.fromEntries(CADRE_RUNTIME_SLOTS.map((slot) => [slot.terminalType, slot.adapter])) as Record<
    CadreTerminalType,
    CadreRuntimeAdapterId
  >;

export function cadreAdapterForType(type: CadreTerminalType): CadreRuntimeAdapterId {
  return CADRE_RUNTIME_ADAPTER_BY_TYPE[type];
}

export function isCadreTerminalType(value: unknown): value is CadreTerminalType {
  return typeof value === "string" && (CADRE_TERMINAL_TYPES as readonly string[]).includes(value);
}

export function cadreSlotForType(type: CadreTerminalType): CadreRuntimeSlot {
  const slot = CADRE_RUNTIME_SLOTS.find((entry) => entry.terminalType === type);
  if (!slot) throw new Error(`Unknown cadre terminal type: ${type}`);
  return slot;
}

export function defaultCadreRuntime(type: CadreTerminalType): CadreRuntime {
  const slot = cadreSlotForType(type);
  return {
    id: slot.id,
    name: slot.name,
    status: "stopped",
    terminalType: type,
    startedAt: null,
    pid: null,
    adapter: slot.adapter,
    readiness: "stopped",
    readinessReason: "Not running",
    lastReadinessAt: null,
  };
}

export function formatCadreReadinessLabel(readiness: CadreRuntimeReadiness): string {
  return readiness.toUpperCase();
}

export function readinessTone(readiness: CadreRuntimeReadiness): "neutral" | "good" | "warn" | "bad" {
  if (readiness === "ready") return "good";
  if (readiness === "starting" || readiness === "unknown") return "neutral";
  if (readiness === "blocked_update_prompt" || readiness === "blocked_auth") return "warn";
  if (readiness === "errored") return "bad";
  return "neutral";
}

export function toRegistryEntry(runtime: CadreRuntime): CadreRuntimeRegistryEntry {
  return {
    runtime_id: runtime.id,
    agent_name: runtime.name,
    status: runtime.status,
    pid: runtime.pid,
    start_time: runtime.startedAt,
    terminal_type: runtime.terminalType,
  };
}

export function formatCadreUptime(startedAt: string | null, now = Date.now()): string {
  if (!startedAt) return "—";
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return "—";
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${seconds % 60}s`;
  return `${seconds}s`;
}
