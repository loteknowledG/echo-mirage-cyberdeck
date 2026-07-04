"use client";

import { useEffect, useRef } from "react";
import {
  isSurveyTripleLinked,
  runSurveyHubConnect,
  SURVEY_HUB_CONNECT_REQUEST_EVENT,
} from "@/lib/cyberdeck/survey-hub.client";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";

/** Cumulative delays after cyberdeck open — keeps trying until triple-linked or cap. */
const AUTO_CONNECT_RETRY_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000, 45_000, 60_000, 90_000] as const;

/** Survey Hub auto-connect on cyberdeck open and on explicit request (MUTHUR / operator). */
export function SurveyAutoPairHost() {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isSurveyHubEnabled()) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const run = async (force: boolean, quiet: boolean) => {
      if (runningRef.current || cancelled) return;
      if (await isSurveyTripleLinked()) return;

      runningRef.current = true;
      try {
        await runSurveyHubConnect({ force, quiet });
      } finally {
        runningRef.current = false;
      }
    };

    for (const delayMs of AUTO_CONNECT_RETRY_MS) {
      const timerId = window.setTimeout(() => {
        void run(true, delayMs > 0);
      }, delayMs);
      cleanups.push(() => window.clearTimeout(timerId));
    }

    const onRequest = () => {
      void run(true, false);
    };
    window.addEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
      window.removeEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);
    };
  }, []);

  return null;
}

export function requestSurveyAutoPair(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_HUB_CONNECT_REQUEST_EVENT));
}

/** @deprecated use requestSurveyAutoPair */
export const requestSurveyHubConnect = requestSurveyAutoPair;
