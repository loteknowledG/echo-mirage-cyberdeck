"use client";

import { useEffect, useState } from "react";
import type { MediaProtectionStatus } from "@/lib/tunes/types";

export function readMediaProtectionStatus(): MediaProtectionStatus {
  if (typeof window === "undefined") return "unavailable";
  const bridge = window.echoMirageMediaProtection;
  if (!bridge) return "unavailable";
  return "unavailable";
}

async function fetchMediaProtectionStatus(): Promise<MediaProtectionStatus> {
  if (typeof window === "undefined") return "unavailable";
  const bridge = window.echoMirageMediaProtection;
  if (!bridge) return "unavailable";
  try {
    return await bridge.getStatus();
  } catch {
    return "failed";
  }
}

export function useMediaProtectionStatus(): MediaProtectionStatus {
  const [status, setStatus] = useState<MediaProtectionStatus>("unavailable");

  useEffect(() => {
    const bridge = window.echoMirageMediaProtection;
    if (!bridge) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    void fetchMediaProtectionStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    const unsubscribe = bridge.subscribe((next) => setStatus(next));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}

export function mediaProtectionLabel(status: MediaProtectionStatus): string {
  switch (status) {
    case "unavailable":
      return "MEDIA PROTECTION // N/A (BROWSER)";
    case "disabled":
      return "MEDIA PROTECTION // DISABLED";
    case "initializing":
      return "MEDIA PROTECTION // INITIALIZING";
    case "enabled":
      return "MEDIA PROTECTION // ENABLED";
    case "failed":
      return "MEDIA PROTECTION // FAILED (PLAYBACK OK)";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
