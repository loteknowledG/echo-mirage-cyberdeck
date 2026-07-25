"use client";

export type BackgroundPollState = {
  subscriberCount: number;
  running: boolean;
  consecutiveErrors: number;
  lastTickAt: number | null;
  lastErrorAt: number | null;
  nextTickAt: number | null;
  hiddenPaused: boolean;
};

export type BackgroundPollEnvironment = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  isDocumentHidden: () => boolean;
  addVisibilityListener: (listener: () => void) => () => void;
};

const DEFAULT_ENV: BackgroundPollEnvironment = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
  isDocumentHidden: () =>
    typeof document !== "undefined" && document.visibilityState === "hidden",
  addVisibilityListener: (listener) => {
    if (typeof document === "undefined") return () => undefined;
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
};

export type BackgroundPollConfig = {
  id: string;
  tick: (signal: AbortSignal) => Promise<void>;
  /** Base interval when healthy and visible. */
  getBaseIntervalMs: () => number;
  minIntervalMs?: number;
  maxBackoffMs?: number;
  /** When false, polling is fully disabled (e.g. relay off on Vercel demo). */
  isEnabled?: () => boolean;
  env?: BackgroundPollEnvironment;
};

function jitterMs(maxJitterMs: number, random = Math.random): number {
  return Math.floor(random() * maxJitterMs);
}

function backoffIntervalMs(
  baseMs: number,
  consecutiveErrors: number,
  maxBackoffMs: number,
  random = Math.random,
): number {
  if (consecutiveErrors <= 0) return baseMs;
  const exponent = Math.min(consecutiveErrors, 8);
  const scaled = Math.min(baseMs * 2 ** exponent, maxBackoffMs);
  return scaled + jitterMs(Math.min(5_000, Math.floor(scaled * 0.1)), random);
}

export function createBackgroundPoll(config: BackgroundPollConfig) {
  const env = config.env ?? DEFAULT_ENV;
  const minIntervalMs = config.minIntervalMs ?? 1_000;
  const maxBackoffMs = config.maxBackoffMs ?? 5 * 60_000;

  let subscriberCount = 0;
  let notifyCount = 0;
  const listeners = new Set<() => void>();
  let timerId: number | null = null;
  let abortController: AbortController | null = null;
  let inFlight = false;
  let consecutiveErrors = 0;
  let lastTickAt: number | null = null;
  let lastErrorAt: number | null = null;
  let nextTickAt: number | null = null;
  let hiddenPaused = false;
  let visibilityCleanup: (() => void) | null = null;

  function getState(): BackgroundPollState {
    return {
      subscriberCount,
      running: timerId != null || inFlight,
      consecutiveErrors,
      lastTickAt,
      lastErrorAt,
      nextTickAt,
      hiddenPaused,
    };
  }

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function clearScheduledTick() {
    if (timerId != null) {
      env.clearTimeout(timerId);
      timerId = null;
    }
    nextTickAt = null;
  }

  function abortInFlight() {
    abortController?.abort();
    abortController = null;
  }

  function scheduleNextTick(delayMs: number) {
    clearScheduledTick();
    const clamped = delayMs <= 0 ? 0 : Math.max(minIntervalMs, delayMs);
    nextTickAt = env.now() + clamped;
    timerId = env.setTimeout(() => {
      timerId = null;
      void runTick();
    }, clamped);
  }

  async function runTick(manual = false) {
    if (subscriberCount <= 0 && !manual) return;
    if (config.isEnabled && !config.isEnabled()) {
      hiddenPaused = true;
      clearScheduledTick();
      return;
    }
    if (env.isDocumentHidden()) {
      hiddenPaused = true;
      clearScheduledTick();
      return;
    }
    hiddenPaused = false;
    if (inFlight) return;

    inFlight = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    try {
      await config.tick(signal);
      if (signal.aborted) return;
      consecutiveErrors = 0;
      lastTickAt = env.now();
      notifyListeners();
      if (subscriberCount > 0) {
        scheduleNextTick(config.getBaseIntervalMs());
      }
    } catch (error) {
      if (signal.aborted) return;
      consecutiveErrors += 1;
      lastErrorAt = env.now();
      notifyListeners();
      if (subscriberCount > 0) {
        scheduleNextTick(
          backoffIntervalMs(config.getBaseIntervalMs(), consecutiveErrors, maxBackoffMs),
        );
      }
      void error;
    } finally {
      inFlight = false;
      if (abortController?.signal === signal) {
        abortController = null;
      }
    }
  }

  function ensureVisibilityListener() {
    if (visibilityCleanup) return;
    visibilityCleanup = env.addVisibilityListener(() => {
      if (subscriberCount <= 0) return;
      if (env.isDocumentHidden()) {
        hiddenPaused = true;
        clearScheduledTick();
        abortInFlight();
        return;
      }
      hiddenPaused = false;
      if (timerId == null && !inFlight) {
        scheduleNextTick(0);
      }
    });
  }

  function startIfNeeded() {
    if (subscriberCount <= 0) return;
    ensureVisibilityListener();
    if (env.isDocumentHidden()) {
      hiddenPaused = true;
      return;
    }
    if (timerId == null && !inFlight) {
      scheduleNextTick(0);
    }
  }

  function stopIfIdle() {
    if (subscriberCount > 0) return;
    clearScheduledTick();
    abortInFlight();
    hiddenPaused = false;
    if (visibilityCleanup) {
      visibilityCleanup();
      visibilityCleanup = null;
    }
  }

  function subscribe(onNotify?: () => void): () => void {
    subscriberCount += 1;
    if (onNotify) listeners.add(onNotify);

    startIfNeeded();

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (onNotify) listeners.delete(onNotify);
      stopIfIdle();
    };
  }

  async function refresh(): Promise<void> {
    await runTick(true);
  }

  return {
    id: config.id,
    subscribe,
    refresh,
    getSubscriberCount: () => subscriberCount,
    getNotifyListenerCount: () => listeners.size,
    getState,
    /** Test-only: run one tick bypassing subscriber guard. */
    __runTickForTests: (manual = true) => runTick(manual),
    /** Test-only: inspect next scheduled delay. */
    __getNextTickAt: () => nextTickAt,
  };
}

export type BackgroundPollHandle = ReturnType<typeof createBackgroundPoll>;
