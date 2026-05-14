import { clearMarkers } from "./indicate-layer";
import { endWorkflow, registerWatchdogCanceller } from "./guided-workflow";
import { pauseNarration, resumeNarration } from "./narration";
import { resetPresence } from "./cursor-presence";

export interface TeardownResult {
  indicatorsCleared: boolean;
  workflowEnded: boolean;
  narrationPaused: boolean;
  presenceReset: boolean;
}

export function emergencyStop(): TeardownResult {
  cancelTeachingWatchdog();

  try {
    endWorkflow();
  } catch {
    /* drop teardown errors */
  }

  try {
    clearMarkers();
  } catch {
    /* drop teardown errors */
  }

  try {
    pauseNarration();
  } catch {
    /* drop teardown errors */
  }

  try {
    resetPresence();
  } catch {
    /* drop teardown errors */
  }

  return {
    indicatorsCleared: true,
    workflowEnded: true,
    narrationPaused: true,
    presenceReset: true,
  };
}

export function resumeAfterStop(): void {
  resumeNarration();
}

let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
const WATCHDOG_TIMEOUT_MS = 60_000;

let stepWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
const STEP_WATCHDOG_TIMEOUT_MS = 30_000;

export function startTeachingWatchdog(): void {
  cancelTeachingWatchdog();
  registerWatchdogCanceller(cancelTeachingWatchdog);
  watchdogTimer = setTimeout(() => {
    emergencyStop();
  }, WATCHDOG_TIMEOUT_MS);
}

export function startStepWatchdog(onTimeout: () => void): void {
  cancelStepWatchdog();
  stepWatchdogTimer = setTimeout(() => {
    onTimeout();
  }, STEP_WATCHDOG_TIMEOUT_MS);
}

export function cancelStepWatchdog(): void {
  if (stepWatchdogTimer !== null) {
    clearTimeout(stepWatchdogTimer);
    stepWatchdogTimer = null;
  }
}

export function cancelTeachingWatchdog(): void {
  cancelStepWatchdog();
  if (watchdogTimer !== null) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

export function acknowledgeWatchdog(): void {
  cancelTeachingWatchdog();
  startTeachingWatchdog();
}

export function isWatchdogActive(): boolean {
  return watchdogTimer !== null;
}