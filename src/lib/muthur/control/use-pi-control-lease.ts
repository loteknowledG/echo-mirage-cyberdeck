"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function persistPendingRequest(pending: PiControlLeaseRequest | null): void {
  if (typeof window === "undefined") return;
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

async function fetchSnapshot(): Promise<PiControlLeaseSnapshot> {
  const res = await fetch("/api/muthur/control-lease", { cache: "no-store" });
  if (!res.ok) return EMPTY_SNAPSHOT;
  const payload = (await res.json()) as PiControlLeaseSnapshot & { ok?: boolean };
  return {
    pendingRequest: payload.pendingRequest ?? null,
    activeLease: payload.activeLease ?? null,
    conflictDetected: Boolean(payload.conflictDetected),
    receipts: payload.receipts ?? [],
  };
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
  return {
    pendingRequest: payload.pendingRequest ?? null,
    activeLease: payload.activeLease ?? null,
    conflictDetected: Boolean(payload.conflictDetected),
    receipts: payload.receipts ?? [],
  };
}

export function usePiControlLease() {
  const [snapshot, setSnapshot] = useState<PiControlLeaseSnapshot>(() => {
    const persisted = loadPersistedPendingRequest();
    return persisted ? { ...EMPTY_SNAPSHOT, pendingRequest: persisted } : EMPTY_SNAPSHOT;
  });
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const refresh = useCallback(async () => {
    const server = await fetchSnapshot();
    setSnapshot((current) => mergeLeaseSnapshot(current, server));
  }, []);

  const requestMission = useCallback(
    async (message: string, mission?: ComputerUseMission) => {
      const next = await postLeaseAction("request", { message, mission });
      if (next.pendingRequest) {
        persistPendingRequest(next.pendingRequest);
      }
      setSnapshot(next);
      return next.pendingRequest;
    },
    [],
  );

  const applyPendingRequest = useCallback((request: PiControlLeaseRequest) => {
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
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!snapshot.pendingRequest && snapshot.activeLease?.leaseStatus !== "active") return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [refresh, snapshot.activeLease?.leaseStatus, snapshot.pendingRequest]);

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
