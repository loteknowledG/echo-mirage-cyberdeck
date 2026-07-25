"use client";

export type ManagedEventSourceOptions = {
  url: string;
  onOpen?: () => void;
  onError?: () => void;
  eventHandlers?: Record<string, (event: MessageEvent) => void>;
  minReconnectMs?: number;
  maxReconnectMs?: number;
  /** When false, do not open or reconnect. */
  isEnabled?: () => boolean;
  /** Pause reconnect while the document is hidden. Default true. */
  pauseWhileHidden?: boolean;
};

type ManagedEventSourceHandle = {
  close: () => void;
  isConnected: () => boolean;
};

export function connectManagedEventSource(
  options: ManagedEventSourceOptions,
): ManagedEventSourceHandle {
  const minReconnectMs = options.minReconnectMs ?? 1_000;
  const maxReconnectMs = options.maxReconnectMs ?? 60_000;
  const pauseWhileHidden = options.pauseWhileHidden ?? true;
  let source: EventSource | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let closed = false;
  let connected = false;

  function shouldConnect(): boolean {
    if (closed) return false;
    if (options.isEnabled && !options.isEnabled()) return false;
    if (
      pauseWhileHidden &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return false;
    }
    return true;
  }

  function clearReconnectTimer() {
    if (reconnectTimer != null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (!shouldConnect()) return;
    clearReconnectTimer();
    const delay =
      Math.min(minReconnectMs * 2 ** reconnectAttempt, maxReconnectMs) +
      Math.floor(Math.random() * 500);
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  }

  function teardownSource() {
    if (!source) return;
    source.close();
    source = null;
    connected = false;
  }

  function open() {
    if (!shouldConnect()) return;
    teardownSource();
    source = new EventSource(options.url);
    source.onopen = () => {
      reconnectAttempt = 0;
      connected = true;
      options.onOpen?.();
    };
    source.onerror = () => {
      connected = false;
      options.onError?.();
      teardownSource();
      scheduleReconnect();
    };
    if (options.eventHandlers) {
      for (const [name, handler] of Object.entries(options.eventHandlers)) {
        source.addEventListener(name, handler);
      }
    }
  }

  const onVisibilityChange = () => {
    if (closed) return;
    if (!shouldConnect()) {
      teardownSource();
      clearReconnectTimer();
      return;
    }
    if (!connected && reconnectTimer == null) {
      reconnectAttempt = 0;
      open();
    }
  };

  if (pauseWhileHidden && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  open();

  return {
    close() {
      closed = true;
      clearReconnectTimer();
      teardownSource();
      if (pauseWhileHidden && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },
    isConnected: () => connected,
  };
}
