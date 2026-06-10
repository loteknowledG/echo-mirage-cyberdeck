import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createEmptyPersistentRuntimeState,
  type MuthurPersistentRuntimeState,
  type MuthurPatrolReceipt,
} from "./runtime-types";

const RUNTIME_DIR = path.join(process.cwd(), ".muthur", "runtime");
const SESSION_PATH = path.join(RUNTIME_DIR, "session.json");
const PATROL_LOG_PATH = path.join(process.cwd(), ".muthur", "logs", "patrol-receipts.jsonl");

export class MuthurRuntimeStore {
  private state: MuthurPersistentRuntimeState = createEmptyPersistentRuntimeState();
  private listeners = new Set<(state: MuthurPersistentRuntimeState) => void>();

  subscribe(listener: (state: MuthurPersistentRuntimeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): MuthurPersistentRuntimeState {
    return structuredClone(this.state);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private patch(partial: Partial<MuthurPersistentRuntimeState>): void {
    this.state = {
      ...this.state,
      ...partial,
      heartbeat_at: new Date().toISOString(),
    };
    this.emit();
  }

  async hydrateFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(SESSION_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<MuthurPersistentRuntimeState>;
      this.state = {
        ...createEmptyPersistentRuntimeState(),
        ...parsed,
        patrol_in_flight: false,
        heartbeat_at: new Date().toISOString(),
      };
      this.emit();
    } catch {
      /* first boot */
    }
  }

  async persistToDisk(): Promise<void> {
    await fs.mkdir(RUNTIME_DIR, { recursive: true });
    const snapshot = this.getSnapshot();
    await fs.writeFile(SESSION_PATH, JSON.stringify(snapshot, null, 2), "utf8");
  }

  setPosture(posture: MuthurPersistentRuntimeState["posture"]): void {
    this.patch({ posture });
  }

  setWatchEnabled(enabled: boolean): void {
    this.patch({
      watch_enabled: enabled,
      posture: enabled ? "watch" : this.state.patrol_in_flight ? "patrol" : "standby",
    });
  }

  setWatchIntervalMs(ms: number): void {
    this.patch({ watch_interval_ms: ms });
  }

  setPatrolInFlight(value: boolean): void {
    this.patch({
      patrol_in_flight: value,
      posture: value ? "patrol" : this.state.watch_enabled ? "watch" : "standby",
    });
  }

  recordPatrol(receipt: MuthurPatrolReceipt): void {
    this.patch({
      last_patrol: receipt,
      patrol_count: this.state.patrol_count + 1,
      patrol_in_flight: false,
      posture: this.state.watch_enabled ? "watch" : "standby",
    });
  }

  stop(): void {
    this.patch({
      watch_enabled: false,
      patrol_in_flight: false,
      posture: "stopped",
    });
  }

  reset(): void {
    this.state = createEmptyPersistentRuntimeState();
    this.emit();
  }

  async appendPatrolReceipt(receipt: MuthurPatrolReceipt): Promise<string> {
    await fs.mkdir(path.dirname(PATROL_LOG_PATH), { recursive: true });
    const receiptPath = path.join(RUNTIME_DIR, `patrol-${receipt.id}.json`);
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
    await fs.appendFile(PATROL_LOG_PATH, `${JSON.stringify({ ...receipt, receipt_path: receiptPath })}\n`, "utf8");
    return receiptPath;
  }
}

let singletonStore: MuthurRuntimeStore | null = null;

export function getMuthurRuntimeStore(): MuthurRuntimeStore {
  if (!singletonStore) singletonStore = new MuthurRuntimeStore();
  return singletonStore;
}

export function resetMuthurRuntimeStoreForTests(): void {
  singletonStore = null;
}
