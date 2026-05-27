import { JsonlDropStore } from "@/lib/dropbay/dropbay-jsonl-store";
import type { CreateDropInput, Drop, ListDropsOptions } from "@/lib/dropbay/dropbay-types";

/** Provider abstraction — swap JsonlDropStore for remote stores without changing API routes. */
export interface DropStore {
  createDrop(input: CreateDropInput): Promise<Drop>;
  persistDrop(drop: Drop): Promise<void>;
  listDrops(options?: ListDropsOptions): Promise<Drop[]>;
  broadcastDrop(drop: Drop): Promise<void>;
}

let store: DropStore | null = null;

export function getDropStore(): DropStore {
  if (!store) {
    store = new JsonlDropStore();
  }
  return store;
}

/** Test hook / future multi-provider wiring. */
export function setDropStore(next: DropStore): void {
  store = next;
}
