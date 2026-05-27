import { randomUUID } from "node:crypto";
import type {
  CreateMuthurActionInput,
  MuthurAction,
  MuthurExecutionMode,
  MuthurRuntimeState,
} from "./execution-types";
import { createEmptyRuntimeState } from "./execution-types";
import { requiresConfirmationForAction } from "./safety-policy";

const MAX_COMPLETED_HISTORY = 50;

function nowIso(): string {
  return new Date().toISOString();
}

export class MuthurExecutionStore {
  private state: MuthurRuntimeState = createEmptyRuntimeState();
  private listeners = new Set<(state: MuthurRuntimeState) => void>();

  subscribe(listener: (state: MuthurRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): MuthurRuntimeState {
    return structuredClone(this.state);
  }

  private emit(): void {
    this.state.heartbeat_at = nowIso();
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private patch(partial: Partial<MuthurRuntimeState>): void {
    this.state = { ...this.state, ...partial, heartbeat_at: nowIso() };
    this.emit();
  }

  setMode(mode: MuthurExecutionMode): void {
    this.patch({ execution_mode: mode });
  }

  setLoopStatus(status: MuthurRuntimeState["loop_status"]): void {
    this.patch({ loop_status: status });
  }

  setCurrentTask(task: string | null): void {
    this.patch({ current_task: task });
  }

  setActiveAction(action: MuthurAction | null): void {
    this.patch({ active_action: action });
  }

  setUserInterrupt(value: boolean): void {
    this.patch({ user_interrupt: value });
  }

  setLastResult(result: MuthurRuntimeState["last_result"], error: string | null = null): void {
    this.patch({ last_result: result, last_error: error });
  }

  setLastVerification(verification: MuthurRuntimeState["last_verification"]): void {
    this.patch({ last_verification: verification });
  }

  markStarted(): void {
    if (!this.state.started_at) {
      this.patch({ started_at: nowIso() });
    }
  }

  enqueueActions(inputs: CreateMuthurActionInput[], taskLabel?: string): MuthurAction[] {
    const created = inputs.map((input) => this.createAction(input));
    const queue = [...this.state.queue, ...created];
    this.patch({
      queue,
      queue_length: queue.length,
      current_task: taskLabel ?? this.state.current_task ?? `batch-${created[0]?.id ?? randomUUID()}`,
    });
    return created;
  }

  createAction(input: CreateMuthurActionInput): MuthurAction {
    const requires_confirmation =
      input.requires_confirmation ?? requiresConfirmationForAction(input);
    const status = requires_confirmation ? "blocked" : "queued";
    return {
      id: randomUUID(),
      type: input.type,
      created_at: nowIso(),
      source: input.source ?? "muthur",
      payload: input.payload,
      requires_confirmation,
      status,
      approval_status: requires_confirmation ? "pending" : undefined,
    };
  }

  peekNextRunnableAction(): MuthurAction | null {
    return this.state.queue.find((action) => action.status === "queued") ?? null;
  }

  findBlockedAction(id: string): MuthurAction | undefined {
    return this.state.queue.find((action) => action.id === id && action.status === "blocked");
  }

  approveAction(id: string): boolean {
    const index = this.state.queue.findIndex((action) => action.id === id);
    if (index < 0) return false;
    const action = this.state.queue[index]!;
    if (action.status !== "blocked") return false;
    const next = [...this.state.queue];
    next[index] = {
      ...action,
      status: "queued",
      approval_status: "approved",
    };
    this.patch({ queue: next, queue_length: next.length });
    return true;
  }

  denyAction(id: string): boolean {
    const index = this.state.queue.findIndex((action) => action.id === id);
    if (index < 0) return false;
    const action = this.state.queue[index]!;
    if (action.status !== "blocked") return false;
    const denied: MuthurAction = {
      ...action,
      status: "cancelled",
      approval_status: "denied",
      completed_at: nowIso(),
      error: "Denied by operator.",
    };
    const queue = this.state.queue.filter((_, i) => i !== index);
    this.pushCompleted(denied);
    this.patch({ queue, queue_length: queue.length });
    return true;
  }

  updateAction(id: string, patch: Partial<MuthurAction>): void {
    const queue = this.state.queue.map((action) => (action.id === id ? { ...action, ...patch } : action));
    const active =
      this.state.active_action?.id === id
        ? { ...this.state.active_action, ...patch }
        : this.state.active_action;
    this.patch({ queue, queue_length: queue.length, active_action: active });
  }

  dequeueAction(id: string): MuthurAction | null {
    const action = this.state.queue.find((item) => item.id === id);
    if (!action) return null;
    const queue = this.state.queue.filter((item) => item.id !== id);
    this.patch({ queue, queue_length: queue.length });
    return action;
  }

  pushCompleted(action: MuthurAction): void {
    const completed_actions = [...this.state.completed_actions, action].slice(-MAX_COMPLETED_HISTORY);
    this.patch({ completed_actions });
  }

  clearQueue(): number {
    const cancelled = this.state.queue.map((action) => ({
      ...action,
      status: "cancelled" as const,
      completed_at: nowIso(),
      error: action.error ?? "Queue cleared by operator.",
    }));
    for (const action of cancelled) this.pushCompleted(action);
    const removed = this.state.queue.length;
    this.patch({ queue: [], queue_length: 0, active_action: null });
    return removed;
  }

  resetInterrupt(): void {
    this.patch({ user_interrupt: false });
  }
}

let singletonStore: MuthurExecutionStore | null = null;

export function getMuthurExecutionStore(): MuthurExecutionStore {
  if (!singletonStore) singletonStore = new MuthurExecutionStore();
  return singletonStore;
}

export function resetMuthurExecutionStoreForTests(): void {
  singletonStore = null;
}
