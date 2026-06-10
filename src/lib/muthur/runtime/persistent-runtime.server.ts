import { getMuthurRuntimeStore, type MuthurRuntimeStore } from "./runtime-store.server";
import { runMuthurHealthPatrol } from "./patrol.server";
import type { MuthurPersistentRuntimeState } from "./runtime-types";

export class MuthurPersistentRuntime {
  private store: MuthurRuntimeStore;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private hydrated = false;
  private patrolPromise: Promise<void> | null = null;

  constructor(store: MuthurRuntimeStore) {
    this.store = store;
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    await this.store.hydrateFromDisk();
    this.hydrated = true;
    if (this.store.getSnapshot().watch_enabled) {
      this.startWatchTimer();
    }
  }

  async getState(): Promise<MuthurPersistentRuntimeState> {
    await this.ensureHydrated();
    return this.store.getSnapshot();
  }

  private startWatchTimer(): void {
    this.stopWatchTimer();
    const intervalMs = this.store.getSnapshot().watch_interval_ms;
    this.watchTimer = setInterval(() => {
      void this.patrolNow("watch-tick").catch((error) => {
        console.warn("[muthur-runtime] watch patrol failed:", error);
      });
    }, intervalMs);
    if (typeof this.watchTimer.unref === "function") {
      this.watchTimer.unref();
    }
  }

  private stopWatchTimer(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  disposeForTests(): void {
    this.stopWatchTimer();
    this.patrolPromise = null;
    this.hydrated = false;
  }

  async startWatch(intervalMs?: number): Promise<MuthurPersistentRuntimeState> {
    await this.ensureHydrated();
    if (typeof intervalMs === "number" && intervalMs >= 30_000) {
      this.store.setWatchIntervalMs(intervalMs);
    }
    this.store.setWatchEnabled(true);
    this.startWatchTimer();
    await this.store.persistToDisk();
    return this.store.getSnapshot();
  }

  async stopWatch(): Promise<MuthurPersistentRuntimeState> {
    await this.ensureHydrated();
    this.stopWatchTimer();
    this.store.setWatchEnabled(false);
    await this.store.persistToDisk();
    return this.store.getSnapshot();
  }

  async patrolNow(taskLabel = "manual-patrol"): Promise<MuthurPersistentRuntimeState> {
    await this.ensureHydrated();
    if (this.store.getSnapshot().patrol_in_flight) {
      return this.store.getSnapshot();
    }
    if (this.patrolPromise) {
      await this.patrolPromise;
      return this.store.getSnapshot();
    }

    this.store.setPatrolInFlight(true);
    await this.store.persistToDisk();

    this.patrolPromise = (async () => {
      try {
        const receipt = await runMuthurHealthPatrol(taskLabel);
        const receiptPath = await this.store.appendPatrolReceipt(receipt);
        receipt.receipt_path = receiptPath;
        this.store.recordPatrol(receipt);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Patrol failed.";
        this.store.recordPatrol({
          id: `failed-${Date.now()}`,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          passed: false,
          checks: [{ check: "patrol", passed: false, message }],
          task_label: taskLabel,
        });
      } finally {
        this.store.setPatrolInFlight(false);
        await this.store.persistToDisk();
        this.patrolPromise = null;
      }
    })();

    await this.patrolPromise;
    return this.store.getSnapshot();
  }

  async stop(): Promise<MuthurPersistentRuntimeState> {
    await this.ensureHydrated();
    this.stopWatchTimer();
    this.store.stop();
    await this.store.persistToDisk();
    return this.store.getSnapshot();
  }

  async reset(): Promise<MuthurPersistentRuntimeState> {
    this.stopWatchTimer();
    this.store.reset();
    this.hydrated = true;
    await this.store.persistToDisk();
    return this.store.getSnapshot();
  }
}

let singletonRuntime: MuthurPersistentRuntime | null = null;

export function getMuthurPersistentRuntime(): MuthurPersistentRuntime {
  if (!singletonRuntime) {
    singletonRuntime = new MuthurPersistentRuntime(getMuthurRuntimeStore());
  }
  return singletonRuntime;
}

export function resetMuthurPersistentRuntimeForTests(): void {
  singletonRuntime?.disposeForTests();
  singletonRuntime = null;
}
