export const MUTHUR_RUNTIME_POSTURES = ["standby", "watch", "patrol", "stopped"] as const;

export type MuthurRuntimePosture = (typeof MUTHUR_RUNTIME_POSTURES)[number];

export const DEFAULT_WATCH_INTERVAL_MS = 5 * 60_000;

export type MuthurPatrolCheck = {
  check: string;
  passed: boolean;
  message: string;
};

export const MUTHUR_BACKGROUND_TASK_KINDS = ["patrol", "verify_cyberdeck"] as const;

export type MuthurBackgroundTaskKind = (typeof MUTHUR_BACKGROUND_TASK_KINDS)[number];

export const MUTHUR_BACKGROUND_TASK_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;

export type MuthurBackgroundTaskStatus = (typeof MUTHUR_BACKGROUND_TASK_STATUSES)[number];

export type MuthurPatrolReceipt = {
  id: string;
  started_at: string;
  completed_at: string;
  passed: boolean;
  checks: MuthurPatrolCheck[];
  task_label: string;
  source?: string;
  receipt_path?: string;
};

export type MuthurBackgroundTask = {
  id: string;
  kind: MuthurBackgroundTaskKind;
  label: string;
  source: string;
  status: MuthurBackgroundTaskStatus;
  created_at: string;
  completed_at?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export const MAX_PATROL_HISTORY = 24;
export const MAX_RECENT_TASKS = 16;

export type MuthurPersistentRuntimeState = {
  posture: MuthurRuntimePosture;
  watch_enabled: boolean;
  watch_interval_ms: number;
  session_started_at: string;
  heartbeat_at: string;
  last_patrol: MuthurPatrolReceipt | null;
  patrol_history: MuthurPatrolReceipt[];
  patrol_in_flight: boolean;
  patrol_count: number;
  task_queue: MuthurBackgroundTask[];
  recent_tasks: MuthurBackgroundTask[];
};

export type MuthurRuntimeControlOp =
  | "start_watch"
  | "stop_watch"
  | "patrol_now"
  | "enqueue_task"
  | "stop"
  | "reset";

export function createEmptyPersistentRuntimeState(): MuthurPersistentRuntimeState {
  const now = new Date().toISOString();
  return {
    posture: "standby",
    watch_enabled: false,
    watch_interval_ms: DEFAULT_WATCH_INTERVAL_MS,
    session_started_at: now,
    heartbeat_at: now,
    last_patrol: null,
    patrol_history: [],
    patrol_in_flight: false,
    patrol_count: 0,
    task_queue: [],
    recent_tasks: [],
  };
}
