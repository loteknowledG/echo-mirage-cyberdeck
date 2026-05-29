import {
  actionRequiresVerification,
  runMuthurAction,
  verificationChecksForAction,
} from "./action-runner";
import { auditExecutionSession, auditSafetyEvent, auditToolAction } from "./audit-log";
import type { CreateMuthurActionInput, MuthurAction, MuthurExecutionMode } from "./execution-types";
import { isVerificationActionType } from "./execution-types";
import { getMuthurExecutionStore, MuthurExecutionStore } from "./execution-store";
import { isReadOnlyObservationAction, requiresConfirmationForAction } from "./safety-policy";
import { writeVerificationReceipt } from "./verification-receipts.server";
import { runVerifyConditions } from "./verification-runner.server";
import type { VerificationOutcome } from "./verification-types";

type RunBatchOptions = {
  taskLabel?: string;
  wait?: boolean;
  timeoutMs?: number;
};

export class MuthurExecutionLoop {
  private store: MuthurExecutionStore;
  private pumpPromise: Promise<void> | null = null;
  private paused = false;
  private abortController: AbortController | null = null;
  private currentTaskLabel: string | null = null;

  constructor(store: MuthurExecutionStore) {
    this.store = store;
  }

  getState() {
    return this.store.getSnapshot();
  }

  subscribe(listener: (state: ReturnType<MuthurExecutionStore["getSnapshot"]>) => void) {
    return this.store.subscribe(listener);
  }

  setMode(mode: MuthurExecutionMode): void {
    this.store.setMode(mode);
    void auditExecutionSession({ event: "mode_changed", mode });
  }

  enqueue(inputs: CreateMuthurActionInput[], options: RunBatchOptions = {}): MuthurAction[] {
    const mode = this.store.getSnapshot().execution_mode;
    const normalized = inputs.map((input) => {
      const requires_confirmation =
        (mode === "observe" || mode === "suggest") && !isReadOnlyObservationAction(input.type)
          ? true
          : requiresConfirmationForAction(input);
      return { ...input, requires_confirmation };
    });
    this.currentTaskLabel = options.taskLabel ?? this.currentTaskLabel;
    const created = this.store.enqueueActions(normalized, options.taskLabel);
    void auditExecutionSession({
      event: "enqueue",
      count: created.length,
      action_ids: created.map((action) => action.id),
      task: options.taskLabel ?? null,
    });
    this.ensurePump();
    return created;
  }

  stop(): void {
    this.store.setUserInterrupt(true);
    this.store.setLoopStatus("stopped");
    this.abortController?.abort();
    void auditExecutionSession({ event: "stop" });
  }

  pause(): void {
    this.paused = true;
    this.store.setLoopStatus("paused");
    void auditExecutionSession({ event: "pause" });
  }

  resume(): void {
    this.paused = false;
    this.store.resetInterrupt();
    this.store.setLoopStatus("running");
    void auditExecutionSession({ event: "resume" });
    this.ensurePump();
  }

  clearQueue(): number {
    this.abortController?.abort();
    const removed = this.store.clearQueue();
    void auditExecutionSession({ event: "clear_queue", removed });
    return removed;
  }

  approve(actionId: string): boolean {
    const ok = this.store.approveAction(actionId);
    if (ok) {
      void auditSafetyEvent({ event: "approve", action_id: actionId });
      this.ensurePump();
    }
    return ok;
  }

  deny(actionId: string): boolean {
    const ok = this.store.denyAction(actionId);
    if (ok) void auditSafetyEvent({ event: "deny", action_id: actionId });
    return ok;
  }

  async waitForIdle(timeoutMs = 120_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const snapshot = this.store.getSnapshot();
      if (snapshot.loop_status !== "running" && snapshot.queue_length === 0 && !snapshot.active_action) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Execution loop timed out waiting for idle.");
  }

  private ensurePump(): void {
    if (this.pumpPromise) return;
    this.pumpPromise = this.pump().finally(() => {
      this.pumpPromise = null;
      const snapshot = this.store.getSnapshot();
      if (snapshot.queue.some((action) => action.status === "queued") && !snapshot.user_interrupt) {
        this.ensurePump();
      } else if (!snapshot.active_action) {
        this.store.setLoopStatus(snapshot.user_interrupt ? "stopped" : "idle");
      }
    });
  }

  private async pump(): Promise<void> {
    this.store.markStarted();
    this.store.setLoopStatus("running");

    while (true) {
      const snapshot = this.store.getSnapshot();
      if (snapshot.user_interrupt) {
        this.store.setLoopStatus("stopped");
        return;
      }
      if (this.paused) {
        this.store.setLoopStatus("paused");
        return;
      }

      const next = this.store.peekNextRunnableAction();
      if (!next) return;

      await this.runOne(next);
    }
  }

  private async runOne(action: MuthurAction): Promise<void> {
    this.abortController = new AbortController();
    const running: MuthurAction = {
      ...action,
      status: "running",
      started_at: new Date().toISOString(),
    };
    this.store.dequeueAction(action.id);
    this.store.setActiveAction(running);

    try {
      const result = await runMuthurAction(running, this.abortController.signal);

      if (isVerificationActionType(action.type)) {
        await this.finalizeWithVerification(running, result, result.metadata?.verification as VerificationOutcome | undefined);
        return;
      }

      const executionSuccess = result.success && result.metadata?.status !== "unsupported";
      if (!executionSuccess) {
        await this.finalizeAction(running, {
          status: result.metadata?.status === "unsupported" ? "unsupported" : "failed",
          result,
          error: result.stderr || result.verification_notes || "Action failed.",
        });
        return;
      }

      if (actionRequiresVerification(action)) {
        const awaiting: MuthurAction = {
          ...running,
          status: "awaiting_verification",
          completed_at: new Date().toISOString(),
          result,
        };
        this.store.setActiveAction(awaiting);
        const checks = verificationChecksForAction(action);
        const verification = await runVerifyConditions(checks);
        await this.finalizeWithVerification(awaiting, result, verification);
        return;
      }

      await this.finalizeAction(running, {
        status: "completed",
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed.";
      await this.finalizeAction(running, {
        status: "failed",
        error: message,
        result: {
          success: false,
          duration_ms: running.started_at ? Date.now() - new Date(running.started_at).getTime() : 0,
          stderr: message,
        },
      });
    } finally {
      this.abortController = null;
    }
  }

  private async finalizeWithVerification(
    action: MuthurAction,
    executionResult: NonNullable<MuthurAction["result"]>,
    verification?: VerificationOutcome,
  ): Promise<void> {
    const outcome =
      verification ??
      ({
        passed: false,
        checks: [{ check: "route_loads", passed: false, message: "Verification outcome missing." }],
        evidence_paths: [],
      } satisfies VerificationOutcome);

    const receiptPath = await writeVerificationReceipt({
      action,
      taskLabel: this.currentTaskLabel,
      executionResult,
      verification: outcome,
    });

    const final: MuthurAction = {
      ...action,
      status: outcome.passed ? "verified" : "verification_failed",
      completed_at: new Date().toISOString(),
      result: executionResult,
      verification: outcome,
      receipt_path: receiptPath,
      error: outcome.passed ? undefined : outcome.checks.filter((check) => !check.passed).map((check) => check.message).join(" | "),
    };
    this.store.setActiveAction(null);
    this.store.pushCompleted(final);
    this.store.setLastVerification(outcome);
    this.store.setLastResult(executionResult, final.error ?? null);
    await auditToolAction(final, executionResult, outcome, receiptPath);
  }

  private async finalizeAction(
    action: MuthurAction,
    patch: Pick<MuthurAction, "status" | "result" | "error">,
  ): Promise<void> {
    const completed: MuthurAction = {
      ...action,
      ...patch,
      completed_at: new Date().toISOString(),
    };
    this.store.setActiveAction(null);
    this.store.pushCompleted(completed);
    this.store.setLastResult(completed.result ?? null, completed.error ?? null);
    await auditToolAction(completed, completed.result);
  }
}

let singletonLoop: MuthurExecutionLoop | null = null;

export function getMuthurExecutionLoop(): MuthurExecutionLoop {
  if (!singletonLoop) singletonLoop = new MuthurExecutionLoop(getMuthurExecutionStore());
  return singletonLoop;
}

export function resetMuthurExecutionLoopForTests(): void {
  singletonLoop = null;
}
