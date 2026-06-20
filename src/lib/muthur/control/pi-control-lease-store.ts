import { nanoid } from "nanoid";
import { requestLease, retake } from "@/lib/computer-use/control-lease";
import { createPiAuthorityReceipt } from "@/lib/muthur/control/pi-control-lease-receipts";
import type {
  ComputerUseMission,
  PiControlLease,
  PiControlLeaseRequest,
  PiControlLeaseSnapshot,
  PiAuthorityReceipt,
} from "@/lib/muthur/control/pi-control-lease-types";

type PiControlLeaseStoreState = {
  pendingRequest: PiControlLeaseRequest | null;
  activeLease: PiControlLease | null;
  conflictDetected: boolean;
  receipts: PiAuthorityReceipt[];
};

const GLOBAL_KEY = "__echoMiragePiControlLeaseStore__";

function createInitialState(): PiControlLeaseStoreState {
  return {
    pendingRequest: null,
    activeLease: null,
    conflictDetected: false,
    receipts: [],
  };
}

function getStore(): PiControlLeaseStoreState {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: PiControlLeaseStoreState;
  };
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = createInitialState();
  }
  return globalRef[GLOBAL_KEY];
}

export function pushPiAuthorityReceipt(receipt: PiAuthorityReceipt): void {
  const store = getStore();
  store.receipts.push(receipt);
  if (store.receipts.length > 50) {
    store.receipts.shift();
  }
}

export function getPiControlLeaseSnapshot(): PiControlLeaseSnapshot {
  const store = getStore();
  if (
    store.activeLease?.leaseExpiresAt &&
    new Date(store.activeLease.leaseExpiresAt) <= new Date()
  ) {
    terminateActiveLease("lease_expired", { emitReceipt: true });
  }
  return {
    pendingRequest: store.pendingRequest ? { ...store.pendingRequest } : null,
    activeLease: store.activeLease ? { ...store.activeLease } : null,
    conflictDetected: store.conflictDetected,
    receipts: [...store.receipts],
  };
}

export function isPiControlLeaseActive(): boolean {
  const snapshot = getPiControlLeaseSnapshot();
  return snapshot.activeLease?.leaseStatus === "active";
}

export function createPiControlLeaseRequest(
  mission: ComputerUseMission,
): PiControlLeaseRequest {
  const store = getStore();
  const leaseId = `lease-${nanoid(10)}`;
  store.pendingRequest = {
    leaseId,
    task: mission.task,
    taskSlug: mission.taskSlug,
    operator: "pi",
    capabilities: [...mission.capabilities],
    reason: mission.reason,
    status: "pending",
    missionText: mission.missionText,
    requestedAt: new Date().toISOString(),
  };
  return { ...store.pendingRequest };
}

export function grantPiControlLease(durationMs?: number): {
  granted: boolean;
  lease?: PiControlLease;
  reason?: string;
} {
  const store = getStore();
  if (!store.pendingRequest) {
    return { granted: false, reason: "No pending control request" };
  }

  const request = store.pendingRequest;
  const leaseDurationMs = durationMs ?? 15 * 60 * 1000;
  const leaseStartedAt = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs).toISOString();

  const granted = requestLease("MUTHUR", "full", {
    durationMs: leaseDurationMs,
    revocable: true,
    reason: `Pi embodiment: ${request.task}`,
  });
  if (!granted.granted) {
    return { granted: false, reason: granted.deniedReason ?? "Lease denied" };
  }

  store.activeLease = {
    leaseId: request.leaseId,
    leaseOwner: "pi",
    leaseReason: request.taskSlug,
    leaseStatus: "active",
    leaseStartedAt,
    leaseDurationMs,
    leaseExpiresAt,
    task: request.task,
    capabilities: [...request.capabilities],
    missionText: request.missionText,
  };
  store.pendingRequest = null;
  store.conflictDetected = false;

  pushPiAuthorityReceipt(
    createPiAuthorityReceipt({
      kind: "authority.grant",
      source: "user",
      target: "pi",
      reason: `grant:${request.taskSlug}`,
      leaseId: store.activeLease.leaseId,
    }),
  );

  return { granted: true, lease: { ...store.activeLease } };
}

export function denyPiControlLease(reason = "operator_denied"): {
  denied: boolean;
} {
  const store = getStore();
  if (!store.pendingRequest) return { denied: false };
  const leaseId = store.pendingRequest.leaseId;
  pushPiAuthorityReceipt(
    createPiAuthorityReceipt({
      kind: "authority.deny",
      source: "user",
      target: "muthur",
      reason,
      leaseId,
    }),
  );
  store.pendingRequest = null;
  retake("USER", "Control request denied");
  return { denied: true };
}

export function terminateActiveLease(
  reason = "mission_complete",
  options?: { emitReceipt?: boolean },
): PiControlLease | null {
  const store = getStore();
  if (!store.activeLease) return null;
  const leaseId = store.activeLease.leaseId;
  const terminated = {
    ...store.activeLease,
    leaseStatus: "terminated" as const,
  };
  store.activeLease = null;
  store.conflictDetected = false;
  retake("USER", reason);
  if (options?.emitReceipt !== false) {
    pushPiAuthorityReceipt(
      createPiAuthorityReceipt({
        kind: "authority.return",
        source: "pi",
        target: "user",
        reason,
        leaseId,
      }),
    );
  }
  return terminated;
}

export function userRetakePiControl(reason = "user_retake"): {
  success: boolean;
  receipt: PiAuthorityReceipt;
} {
  const store = getStore();
  const leaseId = store.activeLease?.leaseId;
  if (!store.activeLease) {
    const receipt = createPiAuthorityReceipt({
      kind: "authority.return",
      source: "pi",
      target: "user",
      reason: `${reason}:no_active_lease`,
      leaseId,
    });
    return { success: false, receipt };
  }

  store.activeLease = null;
  store.pendingRequest = null;
  store.conflictDetected = false;
  retake("USER", reason);

  const receipt = createPiAuthorityReceipt({
    kind: "authority.return",
    source: "pi",
    target: "user",
    reason,
    leaseId,
  });
  pushPiAuthorityReceipt(receipt);
  return { success: true, receipt };
}

export function markPiControlConflict(): void {
  const store = getStore();
  if (store.activeLease?.leaseStatus === "active") {
    store.conflictDetected = true;
  }
}

export function clearPiControlConflict(): void {
  getStore().conflictDetected = false;
}

export function resetPiControlLeaseForTests(): void {
  const store = getStore();
  store.pendingRequest = null;
  store.activeLease = null;
  store.conflictDetected = false;
  store.receipts.length = 0;
  retake("USER", "test_reset");
}
