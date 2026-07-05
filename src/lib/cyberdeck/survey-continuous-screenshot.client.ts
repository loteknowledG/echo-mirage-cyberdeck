"use client";

import { useCallback, useEffect, useState } from "react";
import {
  resolveSurveyEchoDeckContext,
  takeSurveyScreenshot,
  type SurveyDeckCommandContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";

export type SurveyContinuousScreenshotPhase = "idle" | "countdown" | "capturing";

export type SurveyContinuousScreenshotStatus = {
  running: boolean;
  phase: SurveyContinuousScreenshotPhase;
  countdown: number | null;
  shotCount: number;
  message: string;
};

export const SURVEY_CONTINUOUS_SCREENSHOT_CHANGED_EVENT =
  "echo-mirage:survey-continuous-screenshot-changed";

const COUNTDOWN_TICK_MS = 1000;

const IDLE_STATUS: SurveyContinuousScreenshotStatus = {
  running: false,
  phase: "idle",
  countdown: null,
  shotCount: 0,
  message: "",
};

let status: SurveyContinuousScreenshotStatus = IDLE_STATUS;
let loopGeneration = 0;

function emitChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_CONTINUOUS_SCREENSHOT_CHANGED_EVENT));
}

function setStatus(next: SurveyContinuousScreenshotStatus): void {
  status = next;
  emitChanged();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureOnce(ctx: SurveyDeckCommandContext): Promise<{ ok: boolean; message: string }> {
  setStatus({ ...status, phase: "capturing", countdown: null, message: "ECHO · capturing…" });
  const result = await takeSurveyScreenshot(ctx);
  if (result.ok) {
    notifySurveyMuthurArchive(
      `SURVEY DECK // continuous screenshot #${status.shotCount + 1} — ${result.message}`,
    );
  }
  return { ok: result.ok, message: result.message };
}

async function runContinuousLoop(ctx: SurveyDeckCommandContext, generation: number): Promise<void> {
  while (status.running && generation === loopGeneration) {
    const capture = await captureOnce(ctx);
    if (!status.running || generation !== loopGeneration) return;

    const shotCount = status.shotCount + 1;
    setStatus({
      ...status,
      shotCount,
      phase: "countdown",
      message: capture.ok ? `Shot ${shotCount} captured.` : `Shot ${shotCount} failed — ${capture.message}`,
    });

    for (const tick of [3, 2, 1] as const) {
      if (!status.running || generation !== loopGeneration) return;
      setStatus({
        ...status,
        phase: "countdown",
        countdown: tick,
        message: `Next shot in ${tick}…`,
      });
      await sleep(COUNTDOWN_TICK_MS);
    }
  }
}

export function readSurveyContinuousScreenshotStatus(): SurveyContinuousScreenshotStatus {
  return status;
}

export function isSurveyContinuousScreenshotRunning(): boolean {
  return status.running;
}

export async function startSurveyContinuousScreenshot(
  ctx?: SurveyDeckCommandContext,
): Promise<{ ok: boolean; message: string; keepArmed: boolean }> {
  if (status.running) {
    return {
      ok: true,
      message: "Continuous screenshots already running — use Stop.",
      keepArmed: true,
    };
  }

  const echoCtx = ctx ?? resolveSurveyEchoDeckContext();
  if (!echoCtx.echoHost) {
    return { ok: false, message: "Echo host unknown — check TEAM LINKS.", keepArmed: false };
  }

  loopGeneration += 1;
  const generation = loopGeneration;
  setStatus({
    running: true,
    phase: "capturing",
    countdown: null,
    shotCount: 0,
    message: "Starting continuous capture…",
  });

  void runContinuousLoop(echoCtx, generation);

  return {
    ok: true,
    message: "Continuous screenshots started — 3·2·1 between shots.",
    keepArmed: true,
  };
}

export function stopSurveyContinuousScreenshot(): { ok: boolean; message: string } {
  if (!status.running) {
    return { ok: true, message: "Continuous screenshots were not running." };
  }

  const shots = status.shotCount;
  loopGeneration += 1;
  setStatus({
    running: false,
    phase: "idle",
    countdown: null,
    shotCount: shots,
    message: `Stopped after ${shots} shot${shots === 1 ? "" : "s"}.`,
  });
  notifySurveyMuthurArchive(`SURVEY DECK // continuous screenshots stopped · ${shots} total`);

  return {
    ok: true,
    message: `Stopped continuous screenshots (${shots} captured).`,
  };
}

export function useSurveyContinuousScreenshotStatus(): SurveyContinuousScreenshotStatus {
  const [snapshot, setSnapshot] = useState<SurveyContinuousScreenshotStatus>(() =>
    readSurveyContinuousScreenshotStatus(),
  );

  const refresh = useCallback(() => {
    setSnapshot({ ...readSurveyContinuousScreenshotStatus() });
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(SURVEY_CONTINUOUS_SCREENSHOT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SURVEY_CONTINUOUS_SCREENSHOT_CHANGED_EVENT, refresh);
  }, [refresh]);

  return snapshot;
}
