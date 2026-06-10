"use client";

import { useCallback, useEffect, useState } from "react";
import type { MuthurPersistentRuntimeState } from "@/lib/muthur/runtime/runtime-types";

const RUNTIME_API = "/api/muthur/runtime";

async function fetchRuntimeState(): Promise<MuthurPersistentRuntimeState | null> {
  try {
    const res = await fetch(RUNTIME_API, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: MuthurPersistentRuntimeState };
    return data.state ?? null;
  } catch {
    return null;
  }
}

async function postRuntime(body: Record<string, unknown>) {
  const res = await fetch(RUNTIME_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Runtime control failed.");
  }
  return data as { state?: MuthurPersistentRuntimeState; ok?: boolean };
}

export function useMuthurPersistentRuntime(pollMs = 2000, pollEnabled = true) {
  const [state, setState] = useState<MuthurPersistentRuntimeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchRuntimeState();
    if (next) {
      setState(next);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!pollEnabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollEnabled, pollMs, refresh]);

  const control = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const data = await postRuntime(body);
      if (data.state) setState(data.state);
      return data;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Runtime control failed.";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    error,
    busy,
    refresh,
    startWatch: () => control({ op: "start_watch" }),
    stopWatch: () => control({ op: "stop_watch" }),
    patrolNow: (taskLabel?: string) =>
      control({ op: "patrol_now", taskLabel: taskLabel ?? "ui-patrol", source: "ui" }),
    enqueueTask: (input: {
      kind: "patrol" | "verify_cyberdeck";
      label: string;
      source?: string;
    }) =>
      control({
        op: "enqueue_task",
        kind: input.kind,
        label: input.label,
        source: input.source ?? "ui",
      }),
    stop: () => control({ op: "stop" }),
    reset: () => control({ op: "reset" }),
  };
}
