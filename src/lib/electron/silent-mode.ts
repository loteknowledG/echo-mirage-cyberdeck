"use client";

import { useCallback, useEffect, useState } from "react";

export const SILENT_MODE_STORAGE_KEY = "echo-mirage-silent-mode-v1";

export function isSilentModeBridgeAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.echoMirageSilentMode);
}

function readCachedSilentMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SILENT_MODE_STORAGE_KEY);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as { enabled?: boolean } | null;
    return parsed?.enabled === true;
  } catch {
    return false;
  }
}

function writeCachedSilentMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SILENT_MODE_STORAGE_KEY, JSON.stringify({ enabled }));
  } catch {
    /* ignore storage failures */
  }
}

export async function fetchSilentModeEnabled(): Promise<boolean | null> {
  const bridge = window.echoMirageSilentMode;
  if (!bridge) return null;
  try {
    const result = await bridge.getEnabled();
    writeCachedSilentMode(result.enabled);
    return result.enabled;
  } catch {
    return null;
  }
}

export async function requestSilentModeEnabled(enabled: boolean): Promise<boolean | null> {
  const bridge = window.echoMirageSilentMode;
  if (!bridge) return null;
  try {
    const result = await bridge.setEnabled(enabled);
    writeCachedSilentMode(result.enabled);
    return result.enabled;
  } catch {
    return null;
  }
}

export function useSilentModeSetting(): {
  available: boolean;
  enabled: boolean;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
} {
  const [available] = useState(() => isSilentModeBridgeAvailable());
  const [enabled, setEnabledState] = useState(() => readCachedSilentMode());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const bridge = window.echoMirageSilentMode;
    if (!bridge) {
      setHydrated(true);
      return;
    }

    let cancelled = false;
    void fetchSilentModeEnabled().then((next) => {
      if (cancelled || next === null) return;
      setEnabledState(next);
    }).finally(() => {
      if (!cancelled) setHydrated(true);
    });

    const unsubscribe = bridge.subscribe((payload) => {
      setEnabledState(payload.enabled);
      writeCachedSilentMode(payload.enabled);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    const bridge = window.echoMirageSilentMode;
    if (!bridge) return;
    const resolved = await requestSilentModeEnabled(next);
    if (resolved !== null) {
      setEnabledState(resolved);
    }
  }, []);

  return { available, enabled, hydrated, setEnabled };
}
