import { nanoid } from "nanoid";
import type {
  MuthurReceipt,
  ReceiptType,
  ReceiptStatus,
  ReceiptAuthority,
  ReceiptQuery,
} from "./receipt-types";

const MAX_RECEIPTS = 1000;

interface ReceiptStore {
  receipts: MuthurReceipt[];
}

function getStore(): ReceiptStore {
  if (!globalThis.__echoMirageReceiptStore__) {
    globalThis.__echoMirageReceiptStore__ = {
      receipts: [],
    };
  }
  return globalThis.__echoMirageReceiptStore__;
}

export function createReceiptId(prefix = "rcpt"): string {
  return `${prefix}-${nanoid(12)}`;
}

export function computeContentHash(data: unknown): string {
  const json = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `h_${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export function recordReceipt(receipt: MuthurReceipt): MuthurReceipt {
  const store = getStore();
  store.receipts.push(receipt);
  if (store.receipts.length > MAX_RECEIPTS) {
    store.receipts.splice(0, store.receipts.length - MAX_RECEIPTS);
  }
  return receipt;
}

export function getReceipts(): readonly MuthurReceipt[] {
  return getStore().receipts;
}

export function getReceiptById(receiptId: string): MuthurReceipt | undefined {
  return getStore().receipts.find((r) => r.receiptId === receiptId);
}

export function queryReceipts(query: ReceiptQuery): MuthurReceipt[] {
  let results = getStore().receipts;

  if (query.type) {
    results = results.filter((r) => r.type === query.type);
  }
  if (query.capabilityId) {
    results = results.filter(
      (r) =>
        r.type === "tool.exec" &&
        (r as { capabilityId: string }).capabilityId === query.capabilityId
    );
  }
  if (query.authority) {
    results = results.filter((r) => r.authority === query.authority);
  }
  if (query.status) {
    results = results.filter((r) => r.status === query.status);
  }
  if (query.sinceTimestamp) {
    results = results.filter((r) => r.timestamp >= query.sinceTimestamp!);
  }

  const limit = query.limit ?? 100;
  return results.slice(-limit);
}

export function getReceiptCount(): number {
  return getStore().receipts.length;
}

export function clearReceipts(): void {
  getStore().receipts = [];
}

export interface ReceiptSummary {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byAuthority: Record<string, number>;
  recentReceiptIds: string[];
}

export function getReceiptSummary(): ReceiptSummary {
  const receipts = getStore().receipts;
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byAuthority: Record<string, number> = {};

  for (const r of receipts) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byAuthority[r.authority] = (byAuthority[r.authority] ?? 0) + 1;
  }

  return {
    total: receipts.length,
    byType,
    byStatus,
    byAuthority,
    recentReceiptIds: receipts.slice(-10).map((r) => r.receiptId),
  };
}

export function makeToolExecReceipt(input: {
  capabilityId: string;
  authority: ReceiptAuthority;
  status: ReceiptStatus;
  inputs: Record<string, unknown>;
  outputs?: unknown;
  durationMs?: number;
  error?: string;
  delegatedFrom?: string;
}): MuthurReceipt {
  const receipt = {
    receiptId: createReceiptId("exec"),
    type: "tool.exec" as ReceiptType,
    authority: input.authority,
    timestamp: new Date().toISOString(),
    status: input.status,
    capabilityId: input.capabilityId,
    inputs: input.inputs,
    outputs: input.outputs,
    durationMs: input.durationMs,
    error: input.error,
    delegatedFrom: input.delegatedFrom,
    contentHash: computeContentHash({
      capabilityId: input.capabilityId,
      inputs: input.inputs,
      outputs: input.outputs,
    }),
  };
  return recordReceipt(receipt as MuthurReceipt);
}

export function makeAuthorityReceipt(input: {
  kind: "authority.delegate" | "authority.return";
  authority: ReceiptAuthority;
  from: ReceiptAuthority;
  to: ReceiptAuthority;
  reason: string;
  capabilityId?: string;
  leaseId?: string;
}): MuthurReceipt {
  const receipt = {
    receiptId: createReceiptId("auth"),
    type: input.kind,
    authority: input.authority,
    timestamp: new Date().toISOString(),
    status: "success" as ReceiptStatus,
    from: input.from,
    to: input.to,
    capabilityId: input.capabilityId,
    leaseId: input.leaseId,
    reason: input.reason,
  };
  return recordReceipt(receipt as MuthurReceipt);
}

export function makeVerifyReceipt(input: {
  authority: ReceiptAuthority;
  claimReceiptId: string;
  verificationType: "content_hash" | "input_output" | "visual" | "logical";
  matches: boolean;
  details?: string;
  durationMs?: number;
}): MuthurReceipt {
  const status: ReceiptStatus = input.matches ? "success" : "failed";
  const receipt = {
    receiptId: createReceiptId("verify"),
    type: (input.matches ? "verify.pass" : "verify.fail") as ReceiptType,
    authority: input.authority,
    timestamp: new Date().toISOString(),
    status,
    claimReceiptId: input.claimReceiptId,
    verificationType: input.verificationType,
    matches: input.matches,
    details: input.details,
    durationMs: input.durationMs,
  };
  return recordReceipt(receipt as MuthurReceipt);
}

declare global {
  // eslint-disable-next-line no-var
  var __echoMirageReceiptStore__: ReceiptStore | undefined;
}
