export const MUTHUR_RUNTIME_POSTURES = ["standby", "watch", "patrol", "stopped"] as const;

export type MuthurRuntimePosture = (typeof MUTHUR_RUNTIME_POSTURES)[number];

export const DEFAULT_WATCH_INTERVAL_MS = 5 * 60_000;

export type MuthurPatrolCheck = {
  check: string;
  passed: boolean;
  message: string;
};

export type MuthurPatrolReceipt = {
  id: string;
  started_at: string;
  completed_at: string;
  passed: boolean;
  checks: MuthurPatrolCheck[];
  task_label: string;
  receipt_path?: string;
};

export type MuthurPersistentRuntimeState = {
  posture: MuthurRuntimePosture;
  watch_enabled: boolean;
  watch_interval_ms: number;
  session_started_at: string;
  heartbeat_at: string;
  last_patrol: MuthurPatrolReceipt | null;
  patrol_in_flight: boolean;
  patrol_count: number;
};

export type MuthurRuntimeControlOp =
  | "start_watch"
  | "stop_watch"
  | "patrol_now"
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
    patrol_in_flight: false,
    patrol_count: 0,
  };
}
