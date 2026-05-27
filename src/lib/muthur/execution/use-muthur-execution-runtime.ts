"use client";

import { useCallback, useEffect, useState } from "react";
import type { MuthurRuntimeState } from "@/lib/muthur/execution/execution-types";

const EXECUTION_API = "/api/muthur/execution";

async function fetchExecutionState(): Promise<MuthurRuntimeState | null> {
  try {
    const res = await fetch(EXECUTION_API, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { state?: MuthurRuntimeState };
    return data.state ?? null;
  } catch {
    return null;
  }
}

async function postExecution(body: Record<string, unknown>) {
  const res = await fetch(EXECUTION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Execution control failed.");
  }
  return data as { state?: MuthurRuntimeState; ok?: boolean; results?: unknown[] };
}

export function useMuthurExecutionRuntime(pollMs = 800) {
  const [state, setState] = useState<MuthurRuntimeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchExecutionState();
    if (next) {
      setState(next);
      setError(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  const control = useCallback(async (body: Record<string, unknown>) => {
    const data = await postExecution(body);
    if (data.state) setState(data.state);
    return data;
  }, []);

  return {
    state,
    error,
    refresh,
    stop: () => control({ op: "stop" }),
    pause: () => control({ op: "pause" }),
    resume: () => control({ op: "resume" }),
    clearQueue: () => control({ op: "clear_queue" }),
    approve: (actionId: string) => control({ op: "approve", actionId }),
    deny: (actionId: string) => control({ op: "deny", actionId }),
    setMode: (mode: MuthurRuntimeState["execution_mode"]) => control({ op: "set_mode", mode }),
  };
}

export async function enqueueMuthurActions(
  actions: Array<{ type: string; payload: Record<string, unknown>; source?: string }>,
  options?: { wait?: boolean; mode?: MuthurRuntimeState["execution_mode"]; taskLabel?: string },
) {
  return postExecution({
    op: "enqueue",
    actions,
    wait: options?.wait ?? false,
    mode: options?.mode,
    taskLabel: options?.taskLabel,
  });
}
