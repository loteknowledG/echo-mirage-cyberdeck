/** Client-safe cadre runtime model and slot registry. */

export const CADRE_TERMINAL_TYPES = ["codex", "cursor", "opencode", "pi"] as const;

export type CadreTerminalType = (typeof CADRE_TERMINAL_TYPES)[number];

export type CadreRuntimeStatus = "starting" | "running" | "stopped";

export type CadreRuntime = {
  id: string;
  name: string;
  status: CadreRuntimeStatus;
  terminalType: CadreTerminalType;
  startedAt: string | null;
  pid: number | null;
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
};

export const CADRE_RUNTIME_SLOTS: readonly CadreRuntimeSlot[] = [
  { id: "codex", name: "CODEX", terminalType: "codex" },
  { id: "cursor", name: "CURSOR", terminalType: "cursor" },
  { id: "opencode", name: "OPENCODE", terminalType: "opencode" },
  { id: "pi", name: "PI", terminalType: "pi" },
] as const;

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
  };
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
