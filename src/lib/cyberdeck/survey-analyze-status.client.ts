"use client";

import { useCallback, useEffect, useState } from "react";

export type SurveyAnalyzePhase = "idle" | "running" | "complete" | "failed";

export type SurveyAnalyzeStatus = {
  phase: SurveyAnalyzePhase;
  itemId: string | null;
  itemIndex: number | null;
  itemTotal: number | null;
  message: string;
  resultText: string | null;
  error: string | null;
  provider: string | null;
  startedAt: string | null;
  updatedAt: string | null;
};

export const SURVEY_ANALYZE_STATUS_CHANGED_EVENT = "echo-mirage:survey-analyze-status-changed";

const STORAGE_KEY = "echo-mirage-survey-analyze-status-v1";
const SYNC_CHANNEL = "echo-mirage-survey-analyze-sync";

const IDLE_STATUS: SurveyAnalyzeStatus = {
  phase: "idle",
  itemId: null,
  itemIndex: null,
  itemTotal: null,
  message: "",
  resultText: null,
  error: null,
  provider: null,
  startedAt: null,
  updatedAt: null,
};

const PROGRESS_MESSAGES = [
  "MUTHUR // Codex handoff — uploading capture…",
  "MUTHUR // Reading screenshot with vision…",
  "MUTHUR // Parsing problem statement…",
  "MUTHUR // Composing solution…",
  "MUTHUR // Still working — Codex may run deeper analysis…",
] as const;

let memoryStatus: SurveyAnalyzeStatus = IDLE_STATUS;
let progressTimer: ReturnType<typeof setInterval> | null = null;
let progressStep = 0;

function emitStatusChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_ANALYZE_STATUS_CHANGED_EVENT));
}

function broadcastStatusRefresh(): void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(SYNC_CHANNEL);
  channel.postMessage({ type: "refresh" });
  channel.close();
}

function writeStatus(next: SurveyAnalyzeStatus): void {
  memoryStatus = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full */
    }
  }
  emitStatusChanged();
  broadcastStatusRefresh();
}

function readStoredStatus(): SurveyAnalyzeStatus {
  if (typeof window === "undefined") return memoryStatus;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryStatus;
    const parsed = JSON.parse(raw) as SurveyAnalyzeStatus;
    if (!parsed || typeof parsed !== "object") return memoryStatus;
    memoryStatus = { ...IDLE_STATUS, ...parsed };
    return memoryStatus;
  } catch {
    return memoryStatus;
  }
}

function stopProgressTicker(): void {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progressStep = 0;
}

function tickProgressMessage(): void {
  if (memoryStatus.phase !== "running") return;
  progressStep = Math.min(progressStep + 1, PROGRESS_MESSAGES.length - 1);
  writeStatus({
    ...memoryStatus,
    message: PROGRESS_MESSAGES[progressStep],
    updatedAt: new Date().toISOString(),
  });
}

export function readSurveyAnalyzeStatus(): SurveyAnalyzeStatus {
  return readStoredStatus();
}

export function beginSurveyAnalyzeStatus(input: {
  itemId: string;
  itemIndex: number;
  itemTotal: number;
  provider?: string;
}): void {
  stopProgressTicker();
  const startedAt = new Date().toISOString();
  writeStatus({
    phase: "running",
    itemId: input.itemId,
    itemIndex: input.itemIndex,
    itemTotal: input.itemTotal,
    message: PROGRESS_MESSAGES[0],
    resultText: null,
    error: null,
    provider: input.provider ?? "codex",
    startedAt,
    updatedAt: startedAt,
  });
  progressTimer = setInterval(tickProgressMessage, 4000);
}

export function completeSurveyAnalyzeStatus(input: {
  ok: boolean;
  resultText?: string;
  error?: string;
  provider?: string;
}): void {
  stopProgressTicker();
  const updatedAt = new Date().toISOString();
  if (input.ok) {
    writeStatus({
      ...memoryStatus,
      phase: "complete",
      message: "MUTHUR // Solution ready.",
      resultText: input.resultText?.trim() || null,
      error: null,
      provider: input.provider ?? memoryStatus.provider,
      updatedAt,
    });
    return;
  }
  writeStatus({
    ...memoryStatus,
    phase: "failed",
    message: "MUTHUR // Analyze failed.",
    resultText: null,
    error: input.error?.trim() || "Unknown error.",
    provider: input.provider ?? memoryStatus.provider,
    updatedAt,
  });
}

export function useSurveyAnalyzeStatus(): SurveyAnalyzeStatus {
  const [status, setStatus] = useState<SurveyAnalyzeStatus>(() => readSurveyAnalyzeStatus());

  const refresh = useCallback(() => {
    setStatus({ ...readSurveyAnalyzeStatus() });
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener(SURVEY_ANALYZE_STATUS_CHANGED_EVENT, onChanged);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === "refresh") refresh();
      };
    }

    return () => {
      window.removeEventListener(SURVEY_ANALYZE_STATUS_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [refresh]);

  return status;
}
