"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "echo-mirage-chunk-reload";

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
    const triggerReload = () => {
      if (typeof window === "undefined") return;

      try {
        if (window.sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        /* sessionStorage unavailable; still reload once */
      }

      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault?.();
        triggerReload();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        triggerReload();
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
