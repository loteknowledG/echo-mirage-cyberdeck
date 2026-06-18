"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCadreEvent } from "@/lib/cadre/cadre-events";
import { ingestCadreEvent } from "@/lib/cadre/cadre-event-bus";
import type { CadreRuntime } from "@/lib/cadre/runtime-registry";
import { CADRE_RUNTIME_SLOTS } from "@/lib/cadre/runtime-registry";

type CadreRuntimesResponse = {
  ok?: boolean;
  ready?: string;
  runtimes?: CadreRuntime[];
  error?: string;
};

type CadreOutputMap = Record<string, { stdout: string; stderr: string }>;

function emptyOutputMap(): CadreOutputMap {
  const map: CadreOutputMap = {};
  for (const slot of CADRE_RUNTIME_SLOTS) {
    map[slot.id] = { stdout: "", stderr: "" };
  }
  return map;
}

function mergeRuntimeList(incoming: CadreRuntime[] | undefined, prev: CadreRuntime[]): CadreRuntime[] {
  if (!incoming?.length) return prev;
  const byId = new Map(prev.map((entry) => [entry.id, entry]));
  for (const runtime of incoming) {
    byId.set(runtime.id, runtime);
  }
  return CADRE_RUNTIME_SLOTS.map((slot) => byId.get(slot.id) ?? {
    id: slot.id,
    name: slot.name,
    status: "stopped",
    terminalType: slot.terminalType,
    startedAt: null,
    pid: null,
    adapter: slot.adapter,
    readiness: "stopped",
    readinessReason: "Not running",
    lastReadinessAt: null,
  });
}

export function useCadreHost() {
  const [runtimes, setRuntimes] = useState<CadreRuntime[]>(() =>
    CADRE_RUNTIME_SLOTS.map((slot) => ({
      id: slot.id,
      name: slot.name,
      status: "stopped" as const,
      terminalType: slot.terminalType,
      startedAt: null,
      pid: null,
      adapter: slot.adapter,
      readiness: "stopped" as const,
      readinessReason: "Not running",
      lastReadinessAt: null,
    })),
  );
  const [outputById, setOutputById] = useState<CadreOutputMap>(emptyOutputMap);
  const [readyMessage, setReadyMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const outputRef = useRef(outputById);

  useEffect(() => {
    outputRef.current = outputById;
  }, [outputById]);

  const appendOutput = useCallback((runtimeId: string, stream: "stdout" | "stderr", line: string) => {
    setOutputById((prev) => {
      const current = prev[runtimeId] ?? { stdout: "", stderr: "" };
      const nextLine = `${line}\n`;
      return {
        ...prev,
        [runtimeId]: {
          ...current,
          [stream]: `${current[stream]}${nextLine}`.slice(-120_000),
        },
      };
    });
  }, []);

  const refreshRuntimes = useCallback(async () => {
    const res = await fetch("/api/cadre/runtimes", { cache: "no-store" });
    const data = (await res.json()) as CadreRuntimesResponse;
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Failed to load cadre runtimes (${res.status})`);
    }
    setRuntimes((prev) => mergeRuntimeList(data.runtimes, prev));
    if (data.ready) {
      setReadyMessage(data.ready);
      ingestCadreEvent({
        type: "host_ready",
        actor: "CADRE",
        message: data.ready,
        severity: "success",
        archive: false,
      });
    }
  }, []);

  const hydrateCadreEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/cadre/events?limit=80", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { events?: unknown[] };
      if (!Array.isArray(data.events)) return;
      for (const entry of data.events) {
        if (isCadreEvent(entry)) ingestCadreEvent(entry);
      }
    } catch {
      /* optional hydration */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshRuntimes();
        await hydrateCadreEvents();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cadre host unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();

    const source = new EventSource("/api/cadre/stream");
    source.addEventListener("ready", () => {
      if (!cancelled) {
        setConnected(true);
        ingestCadreEvent({
          type: "stream_connected",
          actor: "CADRE",
          message: "Cadre activity stream connected",
          severity: "info",
          archive: false,
        });
      }
    });
    source.addEventListener("cadre_event", (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: unknown };
        if (payload.event && isCadreEvent(payload.event)) {
          ingestCadreEvent(payload.event);
        }
      } catch {
        /* ignore malformed cadre event */
      }
    });
    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          runtimeId?: string;
          stdout?: string;
          stderr?: string;
          status?: CadreRuntime["status"];
          readiness?: CadreRuntime["readiness"];
          readinessReason?: string;
          lastReadinessAt?: string | null;
        };
        if (!payload.runtimeId) return;
        setOutputById((prev) => ({
          ...prev,
          [payload.runtimeId!]: {
            stdout: payload.stdout ?? prev[payload.runtimeId!]?.stdout ?? "",
            stderr: payload.stderr ?? prev[payload.runtimeId!]?.stderr ?? "",
          },
        }));
        if (payload.status || payload.readiness) {
          setRuntimes((prev) =>
            prev.map((entry) =>
              entry.id === payload.runtimeId
                ? {
                    ...entry,
                    ...(payload.status ? { status: payload.status } : {}),
                    ...(payload.readiness ? { readiness: payload.readiness } : {}),
                    ...(payload.readinessReason ? { readinessReason: payload.readinessReason } : {}),
                    ...(payload.lastReadinessAt !== undefined
                      ? { lastReadinessAt: payload.lastReadinessAt }
                      : {}),
                  }
                : entry,
            ),
          );
        }
      } catch {
        /* ignore malformed snapshot */
      }
    });
    source.addEventListener("output", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          runtimeId?: string;
          stream?: "stdout" | "stderr";
          line?: string;
        };
        if (!payload.runtimeId || !payload.stream || !payload.line) return;
        appendOutput(payload.runtimeId, payload.stream, payload.line);
      } catch {
        /* ignore malformed output */
      }
    });
    source.addEventListener("status", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          runtimeId?: string;
          status?: CadreRuntime["status"];
          pid?: number | null;
          readiness?: CadreRuntime["readiness"];
          readinessReason?: string;
          lastReadinessAt?: string | null;
        };
        if (!payload.runtimeId || !payload.status) return;
        setRuntimes((prev) =>
          prev.map((entry) =>
            entry.id === payload.runtimeId
              ? {
                  ...entry,
                  status: payload.status!,
                  pid: payload.pid ?? entry.pid,
                  readiness: payload.readiness ?? entry.readiness,
                  readinessReason: payload.readinessReason ?? entry.readinessReason,
                  lastReadinessAt:
                    payload.lastReadinessAt !== undefined
                      ? payload.lastReadinessAt
                      : entry.lastReadinessAt,
                  startedAt:
                    payload.status === "running"
                      ? entry.startedAt ?? new Date().toISOString()
                      : payload.status === "stopped"
                        ? null
                        : entry.startedAt,
                }
              : entry,
          ),
        );
      } catch {
        /* ignore malformed status */
      }
    });
    source.onerror = () => {
      if (!cancelled) {
        setConnected(false);
        ingestCadreEvent({
          type: "stream_disconnected",
          actor: "CADRE",
          message: "Cadre activity stream disconnected",
          severity: "warning",
          archive: false,
        });
      }
    };

    return () => {
      cancelled = true;
      source.close();
      setConnected(false);
      ingestCadreEvent({
        type: "stream_disconnected",
        actor: "CADRE",
        message: "Cadre activity stream closed",
        severity: "info",
        archive: false,
      });
    };
  }, [appendOutput, hydrateCadreEvents, refreshRuntimes]);

  const startRuntime = useCallback(
    async (runtimeId: string) => {
      setBusyId(runtimeId);
      setError(null);
      try {
        const res = await fetch("/api/cadre/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runtime: runtimeId }),
        });
        const data = (await res.json()) as { ok?: boolean; runtime?: CadreRuntime; error?: string };
        if (!res.ok || !data.ok || !data.runtime) {
          throw new Error(data.error ?? `Failed to start ${runtimeId}`);
        }
        setRuntimes((prev) => prev.map((entry) => (entry.id === runtimeId ? data.runtime! : entry)));
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to start ${runtimeId}`);
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const stopRuntime = useCallback(async (runtimeId: string) => {
    setBusyId(runtimeId);
    setError(null);
    try {
      const res = await fetch("/api/cadre/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runtimeId }),
      });
      const data = (await res.json()) as { ok?: boolean; runtime?: CadreRuntime; error?: string };
      if (!res.ok || !data.ok || !data.runtime) {
        throw new Error(data.error ?? `Failed to stop ${runtimeId}`);
      }
      setRuntimes((prev) => prev.map((entry) => (entry.id === runtimeId ? data.runtime! : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to stop ${runtimeId}`);
    } finally {
      setBusyId(null);
    }
  }, []);

  const restartRuntime = useCallback(
    async (runtimeId: string) => {
      await stopRuntime(runtimeId);
      await startRuntime(runtimeId);
    },
    [startRuntime, stopRuntime],
  );

  return {
    runtimes,
    outputById,
    readyMessage,
    loading,
    connected,
    error,
    busyId,
    startRuntime,
    stopRuntime,
    restartRuntime,
    refreshRuntimes,
  };
}
