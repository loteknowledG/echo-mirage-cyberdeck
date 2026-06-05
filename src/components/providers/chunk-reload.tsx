"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "echo-mirage-chunk-reload";
const RELOAD_COOLDOWN_MS = 60_000;

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";

  return /ChunkLoadError|Loading chunk [\w-]+ failed|failed to load chunk/i.test(message);
}

export function ChunkReload() {
  useEffect(() => {
    const triggerReload = (reason: string) => {
      if (typeof window === "undefined") return;

      try {
        const raw = window.sessionStorage.getItem(RELOAD_FLAG);
        const lastAt = raw ? Number.parseInt(raw, 10) : 0;
        if (lastAt && Date.now() - lastAt < RELOAD_COOLDOWN_MS) {
          console.warn("[chunk-reload] skipped — already reloaded recently:", reason);
          return;
        }
        window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      } catch {
        /* sessionStorage unavailable; still reload once */
      }

      console.warn("[chunk-reload] reloading after chunk error:", reason);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault?.();
        triggerReload(String(event.message || event.error || "error"));
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        triggerReload(String(event.reason));
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
