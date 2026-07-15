"use client";

import { useEffect, useRef } from "react";
import {
  dispatchSurveyHubConnectResult,
  SURVEY_HUB_CONNECT_REQUEST_EVENT,
  type SurveyHubConnectRequestDetail,
} from "@/lib/cyberdeck/survey-hub-connect-events";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { runSurveyHubConnect } from "@/lib/cyberdeck/survey-hub.client";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { refreshSurveyTeamStatus } from "@/lib/cyberdeck/survey-team-status-store.client";

/**
 * Background retries after cyberdeck open — always quiet (no MUTHUR spam).
 * Explicit Connect / MUTHUR requests stay loud via the event handler.
 */
const AUTO_CONNECT_RETRY_MS = [2_000, 12_000, 30_000, 60_000] as const;

/** Survey Hub auto-connect on cyberdeck open and on explicit request (MUTHUR / operator). */
export function SurveyAutoPairHost() {
  const runningRef = useRef(false);
  const backgroundStoppedRef = useRef(false);

  useEffect(() => {
    if (!isSurveyHubEnabled()) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    backgroundStoppedRef.current = false;

    const run = async (force: boolean, quiet: boolean, emitResult: boolean) => {
      if (runningRef.current || cancelled) {
        return;
      }

      const fresh = await refreshSurveyTeamStatus();
      if (isSurveyTeamTripleLinked(fresh)) {
        backgroundStoppedRef.current = true;
        if (emitResult) {
          dispatchSurveyHubConnectResult({
            ran: false,
            skipped: "Already triple-linked.",
            steps: [],
          });
        }
        return;
      }

      runningRef.current = true;
      try {
        const result = await runSurveyHubConnect({ force, quiet });
        if (emitResult) {
          dispatchSurveyHubConnectResult(result);
        }
        if (result.ran && result.steps.length > 0 && result.steps.every((step) => step.ok)) {
          backgroundStoppedRef.current = true;
        }
      } finally {
        runningRef.current = false;
      }
    };

    // Background only — never posts hub failures into MUTHUR chat.
    for (const delayMs of AUTO_CONNECT_RETRY_MS) {
      const timerId = window.setTimeout(() => {
        if (cancelled || backgroundStoppedRef.current) return;
        void run(true, true, false);
      }, delayMs);
      cleanups.push(() => window.clearTimeout(timerId));
    }

    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<SurveyHubConnectRequestDetail>).detail;
      void (async () => {
        const fresh = await refreshSurveyTeamStatus();
        if (isSurveyTeamTripleLinked(fresh)) {
          dispatchSurveyHubConnectResult({
            ran: false,
            skipped: "Already triple-linked.",
            steps: [],
          });
          return;
        }
        // Operator / MUTHUR explicit connect may talk; default quiet=false.
        await run(detail?.force !== false, detail?.quiet ?? false, true);
      })();
    };
    window.addEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);

    return () => {
      cancelled = true;
      backgroundStoppedRef.current = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
      window.removeEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);
    };
    // Mount once — do not re-arm when team.loading flickers (that spammed MUTHUR).
  }, []);

  return null;
}

/** @deprecated use SurveyAutoPairHost */
export const SurveyHubAutoConnectHost = SurveyAutoPairHost;
