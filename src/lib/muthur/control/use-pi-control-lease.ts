"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isPiControlLeaseUiGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating.client";
import type {
  PiControlLeaseRequest,
  PiControlLeaseSnapshot,
} from "@/lib/muthur/control/pi-control-lease-types";
import type { ComputerUseMission } from "@/lib/muthur/control/pi-control-lease-types";

const EMPTY_SNAPSHOT: PiControlLeaseSnapshot = {
  pendingRequest: null,
  activeLease: null,
  conflictDetected: false,
  receipts: [],
};

const PENDING_STORAGE_KEY = "echo-mirage-pi-control-pending-v1";
const PENDING_TTL_MS = 30 * 60 * 1000;
const CONTROL_LEASE_CHANGED_EVENT = "echo-mirage:pi-control-lease-changed";
const CONTROL_LEASE_CHANNEL = "echo-mirage-pi-control-lease-sync";

let latestServerSnapshot: PiControlLeaseSnapshot = EMPTY_SNAPSHOT;
let snapshotFetchInFlight: Promise<PiControlLeaseSnapshot> | null = null;

function persistPendingRequest(pending: PiControlLeaseRequest | null): void {
  if (typeof window === "undefined") return;
  if (!isPiControlLeaseUiGatingEnabled()) {
    try {
      window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (!pending) {
      window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* ignore storage failures */
  }
}

function loadPersistedPendingRequest(): PiControlLeaseRequest | null {
  if (!isPiControlLeaseUiGatingEnabled()) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PiControlLeaseRequest;
    if (!pending?.leaseId || !pending?.task) return null;
    const requestedAt = Date.parse(pending.requestedAt);
    if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > PENDING_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
    return pending;
  } catch {
    return null;
  }
}

function mergeLeaseSnapshot(
  local: PiControlLeaseSnapshot,
  server: PiControlLeaseSnapshot,
): PiControlLeaseSnapshot {
  if (!isPiControlLeaseUiGatingEnabled()) {
    return {
      ...server,
      pendingRequest: null,
      receipts: server.receipts.length > 0 ? server.receipts : local.receipts,
    };
  }

  if (server.activeLease?.leaseStatus === "active") {
    persistPendingRequest(null);
    return {
      ...server,
      pendingRequest: null,
      receipts: server.receipts.length > 0 ? server.receipts : local.receipts,
    };
  }

  if (server.pendingRequest) {
    persistPendingRequest(server.pendingRequest);
    return server;
  }

  if (local.pendingRequest) {
    return {
      ...server,
      pendingRequest: local.pendingRequest,
      conflictDetected: server.conflictDetected || local.conflictDetected,
      receipts: server.receipts.length > 0 ? server.receipts : local.receipts,
    };
  }

  return server;
}

function normalizeSnapshot(payload: PiControlLeaseSnapshot): PiControlLeaseSnapshot {
  return {
    pendingRequest: payload.pendingRequest ?? null,
    activeLease: payload.activeLease ?? null,
    conflictDetected: Boolean(payload.conflictDetected),
    receipts: payload.receipts ?? [],
  };
}

function publishLeaseSnapshot(snapshot: PiControlLeaseSnapshot): void {
  latestServerSnapshot = snapshot;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PiControlLeaseSnapshot>(CONTROL_LEASE_CHANGED_EVENT, {
      detail: snapshot,
    }),
  );
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CONTROL_LEASE_CHANNEL);
    channel.postMessage(snapshot);
    channel.close();
  }
}

async function fetchSnapshot(): Promise<PiControlLeaseSnapshot> {
  if (snapshotFetchInFlight) return snapshotFetchInFlight;
  snapshotFetchInFlight = (async () => {
    const res = await fetch("/api/muthur/control-lease", { cache: "no-store" });
    if (!res.ok) return EMPTY_SNAPSHOT;
    const payload = (await res.json()) as PiControlLeaseSnapshot & { ok?: boolean };
    const snapshot = normalizeSnapshot(payload);
    latestServerSnapshot = snapshot;
    return snapshot;
  })();
  try {
    return await snapshotFetchInFlight;
  } finally {
    snapshotFetchInFlight = null;
  }
}

async function postLeaseAction(
  action: string,
  body: Record<string, unknown> = {},
): Promise<PiControlLeaseSnapshot> {
  const res = await fetch("/api/muthur/control-lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = (await res.json()) as PiControlLeaseSnapshot & { ok?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `Control lease ${action} failed (${res.status})`);
  }
  const snapshot = normalizeSnapshot(payload);
  publishLeaseSnapshot(snapshot);
  return snapshot;
}

export function usePiControlLease() {
  const [snapshot, setSnapshot] = useState<PiControlLeaseSnapshot>(() => {
    if (!isPiControlLeaseUiGatingEnabled()) {
      persistPendingRequest(null);
      return EMPTY_SNAPSHOT;
    }
    const persisted = loadPersistedPendingRequest();
    return persisted ? { ...EMPTY_SNAPSHOT, pendingRequest: persisted } : EMPTY_SNAPSHOT;
  });
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const applyServerSnapshot = useCallback((server: PiControlLeaseSnapshot) => {
    latestServerSnapshot = server;
    setSnapshot((current) => mergeLeaseSnapshot(current, server));
  }, []);

  const refresh = useCallback(async () => {
    applyServerSnapshot(await fetchSnapshot());
  }, [applyServerSnapshot]);

  const requestMission = useCallback(
    async (
      message: string,
      mission?: ComputerUseMission,
      options?: { posture?: string },
    ) => {
      const next = await postLeaseAction("request", {
        message,
        mission,
        posture: options?.posture,
      });
      if (!isPiControlLeaseUiGatingEnabled()) {
        persistPendingRequest(null);
        setSnapshot({ ...next, pendingRequest: null });
        return next;
      }
      if (next.pendingRequest) {
        persistPendingRequest(next.pendingRequest);
      } else if (next.activeLease) {
        persistPendingRequest(null);
      }
      setSnapshot(next);
      return next;
    },
    [],
  );

  const applyPendingRequest = useCallback((request: PiControlLeaseRequest) => {
    if (!isPiControlLeaseUiGatingEnabled()) {
      persistPendingRequest(null);
      void (async () => {
        try {
          const next = await postLeaseAction("grant", { pendingRequest: request });
          setSnapshot({ ...next, pendingRequest: null });
        } catch {
          setSnapshot((current) => ({ ...current, pendingRequest: null }));
        }
      })();
      return;
    }
    persistPendingRequest(request);
    setSnapshot((current) => ({ ...current, pendingRequest: request }));
  }, []);

  const grant = useCallback(async () => {
    const pending = snapshotRef.current.pendingRequest;
    const next = await postLeaseAction(
      "grant",
      pending ? { pendingRequest: pending } : {},
    );
    if (next.activeLease) {
      persistPendingRequest(null);
    } else if (next.pendingRequest) {
      persistPendingRequest(next.pendingRequest);
    }
    setSnapshot(next);
    return next.activeLease;
  }, []);

  const deny = useCallback(async () => {
    const pending = snapshotRef.current.pendingRequest;
    const next = await postLeaseAction(
      "deny",
      pending ? { pendingRequest: pending } : {},
    );
    persistPendingRequest(null);
    setSnapshot(next);
  }, []);

  const terminate = useCallback(async (reason?: string) => {
    persistPendingRequest(null);
    setSnapshot(await postLeaseAction("terminate", { reason }));
  }, []);

  const retake = useCallback(async () => {
    persistPendingRequest(null);
    setSnapshot(await postLeaseAction("retake", { reason: "user_retake" }));
  }, []);

  const reportConflict = useCallback(async () => {
    setSnapshot(await postLeaseAction("conflict"));
  }, []);

  const clearConflict = useCallback(async () => {
    setSnapshot(await postLeaseAction("clear_conflict"));
  }, []);

  useEffect(() => {
    if (!isPiControlLeaseUiGatingEnabled()) {
      persistPendingRequest(null);
    }

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<PiControlLeaseSnapshot>).detail;
      if (detail) applyServerSnapshot(detail);
    };
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };

    window.addEventListener(CONTROL_LEASE_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CONTROL_LEASE_CHANNEL);
      channel.onmessage = (event: MessageEvent<PiControlLeaseSnapshot>) => {
        if (event.data) applyServerSnapshot(normalizeSnapshot(event.data));
      };
    }

    // One coalesced seed request. No recurring timer follows it.
    void refresh();

    return () => {
      window.removeEventListener(CONTROL_LEASE_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [applyServerSnapshot, refresh]);

  return {
    snapshot,
    refresh,
    requestMission,
    applyPendingRequest,
    grant,
    deny,
    terminate,
    retake,
    reportConflict,
    clearConflict,
  };
}
