export const MUTHUR_ACTION_TYPES = [
  "shell_command",
  "open_url",
  "click",
  "type_text",
  "read_file",
  "write_file",
  "screenshot",
  "wait",
  "ask_user",
  "verify_condition",
  "verify_page_text",
  "verify_route_loaded",
  "verify_console_clean",
  "get_console_errors",
] as const;

export const VERIFICATION_ACTION_TYPES = [
  "verify_condition",
  "verify_page_text",
  "verify_route_loaded",
  "verify_console_clean",
] as const;

export type VerificationActionType = (typeof VERIFICATION_ACTION_TYPES)[number];

export function isVerificationActionType(type: string): type is VerificationActionType {
  return (VERIFICATION_ACTION_TYPES as readonly string[]).includes(type);
}

export type MuthurActionType = (typeof MUTHUR_ACTION_TYPES)[number];

export const MUTHUR_ACTION_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "blocked",
  "cancelled",
  "unsupported",
  "awaiting_verification",
  "verified",
  "verification_failed",
] as const;

export type MuthurActionStatus = (typeof MUTHUR_ACTION_STATUSES)[number];

export const MUTHUR_EXECUTION_MODES = ["observe", "suggest", "execute"] as const;

export type MuthurExecutionMode = (typeof MUTHUR_EXECUTION_MODES)[number];

export type MuthurActionSource = "muthur" | "user" | "system" | "legacy_json";

import type { VerificationOutcome } from "./verification-types";

export type MuthurActionPayload = Record<string, unknown>;

export interface MuthurAction {
  id: string;
  type: MuthurActionType;
  created_at: string;
  source: MuthurActionSource;
  payload: MuthurActionPayload;
  requires_confirmation: boolean;
  status: MuthurActionStatus;
  started_at?: string;
  completed_at?: string;
  result?: MuthurActionResult;
  error?: string;
  approval_status?: "pending" | "approved" | "denied";
  verification?: VerificationOutcome;
  receipt_path?: string;
}

export interface MuthurActionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms: number;
  screenshot_path?: string;
  metadata?: Record<string, unknown>;
  verification_notes?: string;
}

export interface MuthurRuntimeState {
  current_task: string | null;
  active_action: MuthurAction | null;
  queue: MuthurAction[];
  queue_length: number;
  execution_mode: MuthurExecutionMode;
  loop_status: "idle" | "running" | "paused" | "stopped";
  last_result: MuthurActionResult | null;
  last_error: string | null;
  user_interrupt: boolean;
  started_at: string | null;
  heartbeat_at: string;
  completed_actions: MuthurAction[];
  last_verification: VerificationOutcome | null;
}

export type CreateMuthurActionInput = {
  type: MuthurActionType;
  payload: MuthurActionPayload;
  source?: MuthurActionSource;
  requires_confirmation?: boolean;
};

export type MuthurExecutionControlOp =
  | "enqueue"
  | "stop"
  | "pause"
  | "resume"
  | "clear_queue"
  | "approve"
  | "deny"
  | "set_mode";

export function createEmptyRuntimeState(): MuthurRuntimeState {
  const now = new Date().toISOString();
  return {
    current_task: null,
    active_action: null,
    queue: [],
    queue_length: 0,
    execution_mode: "observe",
    loop_status: "idle",
    last_result: null,
    last_error: null,
    user_interrupt: false,
    started_at: null,
    heartbeat_at: now,
    completed_actions: [],
    last_verification: null,
  };
}
