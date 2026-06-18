import type { CadreTerminalType } from "@/lib/cadre/runtime-registry";

/** Stable event vocabulary — safe for external POWERFIST consumers. */
export const CADRE_EVENT_TYPES = [
  "intent_received",
  "runtime_start_requested",
  "runtime_started",
  "runtime_stop_requested",
  "runtime_stopped",
  "runtime_restart_requested",
  "readiness_changed",
  "verification_pass",
  "verification_fail",
  "assignment_accepted",
  "assignment_completed",
  "result_returned",
  "stream_connected",
  "stream_disconnected",
  "host_ready",
  "host_error",
] as const;

export type CadreEventType = (typeof CADRE_EVENT_TYPES)[number];

export type CadreWorkforceActor =
  | "MUTHUR"
  | "LEAD"
  | "CURSOR"
  | "CODEX"
  | "OPENCODE"
  | "PI"
  | "CADRE";

export type CadreEventSeverity = "info" | "success" | "warning" | "error";

export type CadreEvent = {
  /** Stable id for dedupe and external sync. */
  id: string;
  /** ISO-8601 timestamp. */
  ts: string;
  type: CadreEventType;
  actor: CadreWorkforceActor;
  /** Operator-facing narrative (no raw terminal lines). */
  message: string;
  runtimeId?: CadreTerminalType;
  assignment?: string;
  verification?: "pass" | "fail" | "pending";
  severity: CadreEventSeverity;
  /** Mirror into MUTHUR history when true. */
  archive: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

export type CadreEventInput = Omit<CadreEvent, "id" | "ts" | "archive"> & {
  id?: string;
  ts?: string;
  archive?: boolean;
};

const ARCHIVE_EVENT_TYPES = new Set<CadreEventType>([
  "intent_received",
  "runtime_started",
  "runtime_stopped",
  "readiness_changed",
  "verification_pass",
  "verification_fail",
  "assignment_accepted",
  "assignment_completed",
  "result_returned",
  "host_error",
]);

const RUNTIME_ACTOR: Record<CadreTerminalType, CadreWorkforceActor> = {
  codex: "CODEX",
  cursor: "CURSOR",
  opencode: "OPENCODE",
  pi: "PI",
};

export function runtimeIdToActor(runtimeId: string): CadreWorkforceActor {
  if (runtimeId in RUNTIME_ACTOR) {
    return RUNTIME_ACTOR[runtimeId as CadreTerminalType];
  }
  return "CADRE";
}

export function formatCadreEventLine(event: CadreEvent): string {
  return `[${event.actor}] ${event.message}`;
}

export function formatCadreMuthurArchiveLine(event: CadreEvent): string {
  return `CADRE // ${event.actor} // ${event.message}`;
}

export function shouldArchiveCadreEvent(event: CadreEventInput): boolean {
  if (event.archive != null) return event.archive;
  if (!ARCHIVE_EVENT_TYPES.has(event.type)) return false;

  if (event.type === "readiness_changed") {
    const readiness = event.meta?.readiness;
    return (
      readiness === "ready" ||
      readiness === "errored" ||
      readiness === "blocked_auth" ||
      readiness === "blocked_update_prompt"
    );
  }

  return true;
}

export function buildCadreEvent(input: CadreEventInput): CadreEvent {
  const archive = shouldArchiveCadreEvent(input);
  return {
    id: input.id ?? `cadre-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: input.ts ?? new Date().toISOString(),
    type: input.type,
    actor: input.actor,
    message: input.message,
    runtimeId: input.runtimeId,
    assignment: input.assignment,
    verification: input.verification,
    severity: input.severity,
    archive,
    meta: input.meta,
  };
}

export function isCadreEvent(value: unknown): value is CadreEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.ts === "string" &&
    typeof record.type === "string" &&
    typeof record.actor === "string" &&
    typeof record.message === "string" &&
    typeof record.severity === "string" &&
    typeof record.archive === "boolean"
  );
}
