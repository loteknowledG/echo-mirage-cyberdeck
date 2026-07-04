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
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

/** Cumulative delays after cyberdeck open — keeps trying until triple-linked or cap. */
const AUTO_CONNECT_RETRY_MS = [0, 2_000, 5_000, 10_000, 20_000, 30_000, 45_000, 60_000, 90_000] as const;

/** Survey Hub auto-connect on cyberdeck open and on explicit request (MUTHUR / operator). */
export function SurveyAutoPairHost() {
  const team = useSurveyTeamStatus();
  const tripleLinked = isSurveyTeamTripleLinked(team);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isSurveyHubEnabled()) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const run = async (force: boolean, quiet: boolean, emitResult: boolean) => {
      if (runningRef.current || cancelled || team.loading || tripleLinked) {
        if (emitResult && tripleLinked) {
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
      } finally {
        runningRef.current = false;
      }
    };

    for (const delayMs of AUTO_CONNECT_RETRY_MS) {
      const timerId = window.setTimeout(() => {
        void run(true, delayMs > 0, false);
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
        await run(detail?.force !== false, detail?.quiet ?? false, true);
      })();
    };
    window.addEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
      window.removeEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, onRequest);
    };
  }, [team.loading, tripleLinked]);

  return null;
}

/** @deprecated use SurveyAutoPairHost */
export const SurveyHubAutoConnectHost = SurveyAutoPairHost;
