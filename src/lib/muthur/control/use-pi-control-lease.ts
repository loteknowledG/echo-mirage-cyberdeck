"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [snapshot, setSnapshot] = useState<PiControlLeaseSnapshot>(EMPTY_SNAPSHOT);

  const refresh = useCallback(async () => {
    setSnapshot(await fetchSnapshot());
  }, []);

  const requestMission = useCallback(
    async (message: string, mission?: ComputerUseMission) => {
      const next = await postLeaseAction("request", { message, mission });
      setSnapshot(next);
      return next.pendingRequest;
    },
    [],
  );

  const applyPendingRequest = useCallback((request: PiControlLeaseRequest) => {
    setSnapshot((current) => ({ ...current, pendingRequest: request }));
  }, []);

  const grant = useCallback(async () => {
    const next = await postLeaseAction("grant");
    setSnapshot(next);
    return next.activeLease;
  }, []);

  const deny = useCallback(async () => {
    setSnapshot(await postLeaseAction("deny"));
  }, []);

  const terminate = useCallback(async (reason?: string) => {
    setSnapshot(await postLeaseAction("terminate", { reason }));
  }, []);

  const retake = useCallback(async () => {
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
    }, 2000);
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
