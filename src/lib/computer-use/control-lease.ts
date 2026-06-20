export type ControlOwner = "USER" | "SHARED" | "MUTHUR";

import { narrate } from "./narration";

export type ControlScope =
  | "observation"
  | "input"
  | "output"
  | "control"
  | "full";

export type MUTHURMode = "OBSERVE" | "INDICATE" | "ASSIST" | "USE";

export type ControlEvent =
  | "CONTROL_REQUESTED"
  | "CONTROL_GRANTED"
  | "CONTROL_RETAKEN"
  | "CONTROL_EXPIRED"
  | "CONTROL_DENIED"
  | "INDICATE_STARTED"
  | "INDICATE_UPDATED"
  | "INDICATE_CLEARED";

export interface ControlLease {
  owner: ControlOwner;
  scope: ControlScope;
  grantedAt: string;
  expiresAt: string | null;
  revocable: boolean;
  reason: string;
}

export type ControlEventRecord = {
  event: ControlEvent;
  timestamp: string;
  from?: ControlOwner;
  to?: ControlOwner;
  reason?: string;
  lease?: ControlLease;
};

const DEFAULT_LEASE: ControlLease = {
  owner: "USER",
  scope: "full",
  grantedAt: new Date().toISOString(),
  expiresAt: null,
  revocable: false,
  reason: "Default state",
};

type ControlLeaseStoreState = {
  currentLease: ControlLease;
  muthurMode: MUTHURMode;
  eventLog: ControlEventRecord[];
};

const GLOBAL_KEY = "__echoMirageControlLeaseStore__";

function createInitialState(): ControlLeaseStoreState {
  return {
    currentLease: { ...DEFAULT_LEASE },
    muthurMode: "OBSERVE",
    eventLog: [],
  };
}

function getStore(): ControlLeaseStoreState {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ControlLeaseStoreState;
  };
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = createInitialState();
  }
  return globalRef[GLOBAL_KEY];
}

function getCurrentLeaseRef(): ControlLease {
  return getStore().currentLease;
}

function setCurrentLeaseRef(lease: ControlLease): void {
  getStore().currentLease = lease;
}

function getEventLogRef(): ControlEventRecord[] {
  return getStore().eventLog;
}

function getMuthurModeRef(): MUTHURMode {
  return getStore().muthurMode;
}

function setMuthurModeRef(mode: MUTHURMode): void {
  getStore().muthurMode = mode;
}

const MUTHUR_INPUT_SCOPES = new Set<ControlScope>(["input", "full"]);
const MUTHUR_OBSERVATION_SCOPES = new Set<ControlScope>([
  "observation",
  "input",
  "output",
  "full",
]);

export function emit(event: ControlEvent, extra?: Partial<ControlEventRecord>): void {
  const record: ControlEventRecord = {
    event,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  const eventLog = getEventLogRef();
  eventLog.push(record);
  if (eventLog.length > 100) eventLog.shift();
}

function isExpired(lease: ControlLease): boolean {
  if (!lease.expiresAt) return false;
  return new Date(lease.expiresAt) <= new Date();
}

export function getCurrentOwner(): ControlOwner {
  return getCurrentLeaseRef().owner;
}

export function getCurrentLease(): ControlLease {
  const currentLease = getCurrentLeaseRef();
  if (isExpired(currentLease)) {
    expireLease("Lease expired");
  }
  return { ...getCurrentLeaseRef() };
}

export function getEventLog(): readonly ControlEventRecord[] {
  return [...getEventLogRef()];
}

export function requestLease(
  owner: ControlOwner,
  scope: ControlScope,
  opts?: {
    durationMs?: number;
    revocable?: boolean;
    reason?: string;
  }
): { granted: boolean; lease?: ControlLease; deniedReason?: string } {
  const currentLease = getCurrentLeaseRef();
  emit("CONTROL_REQUESTED", {
    from: currentLease.owner,
    to: owner,
    reason: opts?.reason,
  });
  narrate("CONTROL_REQUESTED");

  if (owner === "USER") {
    grantLease(owner, scope, {
      revocable: false,
      reason: opts?.reason ?? "User request",
    });
    return { granted: true, lease: getCurrentLease() };
  }

  if (currentLease.owner === "USER") {
    if (opts?.durationMs != null && opts.durationMs <= 0) {
      emit("CONTROL_DENIED", {
        from: currentLease.owner,
        to: owner,
        reason: `Invalid duration: ${opts.durationMs}ms must be positive`,
      });
      return {
        granted: false,
        deniedReason: `Invalid duration: ${opts.durationMs}ms must be positive`,
      };
    }
    const expiresAt = opts?.durationMs
      ? new Date(Date.now() + opts.durationMs).toISOString()
      : null;
    grantLease(owner, scope, {
      expiresAt,
      revocable: opts?.revocable ?? true,
      reason: opts?.reason ?? "Lease granted",
    });
    return { granted: true, lease: getCurrentLease() };
  }

  emit("CONTROL_DENIED", {
    from: currentLease.owner,
    to: owner as ControlOwner,
    reason: `Denied: current owner is ${currentLease.owner}`,
  });
  return {
    granted: false,
    deniedReason: `Denied: current owner is ${currentLease.owner}`,
  };
}

/**
 * Internal: updates the lease state directly. Used exclusively by requestLease() within this
 * module. External callers should use requestLease() which enforces policy (duration validation,
 * owner checks, event emission). Calling grantLease() directly bypasses policy and is therefore
 * not exported.
 */
function grantLease(
  owner: ControlOwner,
  scope: ControlScope,
  opts?: {
    expiresAt?: string | null;
    revocable?: boolean;
    reason?: string;
  }
): ControlLease {
  const prev = getCurrentLeaseRef().owner;
  const nextLease: ControlLease = {
    owner,
    scope,
    grantedAt: new Date().toISOString(),
    expiresAt: opts?.expiresAt ?? null,
    revocable: opts?.revocable ?? false,
    reason: opts?.reason ?? "Lease granted",
  };
  setCurrentLeaseRef(nextLease);
  emit("CONTROL_GRANTED", {
    from: prev,
    to: owner,
    lease: { ...nextLease },
    reason: nextLease.reason,
  });
  narrate("CONTROL_GRANTED");
  return { ...nextLease };
}

export function retake(
  requestor: ControlOwner = "USER",
  reason: string = "Retake"
): { success: boolean; previousOwner: ControlOwner } {
  const currentLease = getCurrentLeaseRef();
  if (requestor !== "USER") {
    emit("CONTROL_DENIED", {
      from: currentLease.owner,
      to: requestor,
      reason: "Only USER can unconditionally retake control",
    });
    return { success: false, previousOwner: currentLease.owner };
  }

  const prev = currentLease.owner;
  setCurrentLeaseRef({
    owner: "USER",
    scope: "full",
    grantedAt: new Date().toISOString(),
    expiresAt: null,
    revocable: false,
    reason,
  });
  emit("CONTROL_RETAKEN", {
    from: prev,
    to: requestor,
    reason,
  });
  narrate("CONTROL_RETURNED");
  return { success: true, previousOwner: prev };
}

export function expireLease(reason: string = "Expired"): ControlLease {
  const prev = getCurrentLeaseRef().owner;
  const nextLease: ControlLease = {
    owner: "USER",
    scope: "full",
    grantedAt: new Date().toISOString(),
    expiresAt: null,
    revocable: false,
    reason,
  };
  setCurrentLeaseRef(nextLease);
  emit("CONTROL_EXPIRED", {
    from: prev,
    to: "USER",
    reason,
  });
  narrate("CONTROL_RETURNED");
  return { ...nextLease };
}

export function checkActionPermission(
  actionScope: ControlScope
): { allowed: boolean; reason?: string } {
  const currentLease = getCurrentLeaseRef();
  if (isExpired(currentLease)) {
    expireLease("Automatic expiration");
    const refreshed = getCurrentLeaseRef();
    return {
      allowed: refreshed.scope === "full" || refreshed.scope === actionScope,
      reason: "Lease expired, ownership returned to USER",
    };
  }

  if (currentLease.owner === "USER") {
    return { allowed: true };
  }

  if (currentLease.scope === "full") {
    return { allowed: true };
  }

  if (actionScope === "observation") {
    return {
      allowed: MUTHUR_OBSERVATION_SCOPES.has(currentLease.scope),
      reason:
        currentLease.scope === "output"
          ? `Scope "${currentLease.scope}" does not cover observation`
          : undefined,
    };
  }

  return {
    allowed: MUTHUR_INPUT_SCOPES.has(currentLease.scope),
    reason:
      currentLease.scope === "observation" || currentLease.scope === "output"
        ? `Scope "${currentLease.scope}" does not cover input`
        : undefined,
  };
}

export function canRevoke(): boolean {
  return getCurrentLeaseRef().revocable;
}

export function getMUTHURMode(): MUTHURMode {
  return getMuthurModeRef();
}

export function setMUTHURMode(mode: MUTHURMode): MUTHURMode {
  setMuthurModeRef(mode);
  return getMuthurModeRef();
}

export function emitControlDenied(opts: {
  deniedTo?: ControlOwner;
  reason: string;
}): void {
  const currentLease = getCurrentLeaseRef();
  emit("CONTROL_DENIED", {
    from: currentLease.owner,
    to: opts.deniedTo,
    reason: opts.reason,
    lease: { ...currentLease },
  });
}

export function revokeLease(
  revoker: ControlOwner = "USER",
  reason: string = "Revoked"
): { success: boolean; previousOwner: ControlOwner } {
  const currentLease = getCurrentLeaseRef();
  if (!currentLease.revocable && revoker !== "USER") {
    emit("CONTROL_DENIED", {
      from: currentLease.owner,
      to: revoker,
      reason: "Lease is not revocable",
    });
    return { success: false, previousOwner: currentLease.owner };
  }
  return retake(revoker, reason);
}
