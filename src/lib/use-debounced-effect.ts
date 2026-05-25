"use client";

import { useEffect, useRef } from "react";

/** Runs `effect` after `delayMs` idle; flushes on unmount and beforeunload. */
export function useDebouncedEffect(effect: () => void, deps: readonly unknown[], delayMs = 300) {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      effectRef.current();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, ...deps]);

  useEffect(() => {
    const flush = () => {
      effectRef.current();
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);
}
