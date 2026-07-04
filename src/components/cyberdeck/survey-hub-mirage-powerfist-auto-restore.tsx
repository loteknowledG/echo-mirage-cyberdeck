"use client";

import { useEffect, useRef } from "react";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { runSurveyMiragePowerfistHubRestore } from "@/lib/cyberdeck/survey-hub.client";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { refreshSurveyTeamStatus } from "@/lib/cyberdeck/survey-team-status-store.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

/** Retries Mirage ↔ PowerFist hub pairing after Echo edges are up (EMP + Survey Hub). */
const HUB_RESTORE_RETRY_MS = [0, 4_000, 10_000, 20_000, 35_000, 50_000, 70_000] as const;

export function SurveyHubMiragePowerfistAutoRestore() {
  const team = useSurveyTeamStatus();
  const tripleLinked = isSurveyTeamTripleLinked(team);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isSurveyHubEnabled() || tripleLinked) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const run = async () => {
      if (cancelled || runningRef.current) return;

      const fresh = await refreshSurveyTeamStatus();
      if (isSurveyTeamTripleLinked(fresh)) return;
      if (fresh.miragePowerfist.state === "linked") return;
      if (fresh.echoMirage.state !== "linked" && fresh.echoPowerfist.state !== "linked") return;

      runningRef.current = true;
      try {
        await runSurveyMiragePowerfistHubRestore({ quiet: true });
      } finally {
        runningRef.current = false;
      }
    };

    for (const delayMs of HUB_RESTORE_RETRY_MS) {
      const timerId = window.setTimeout(() => void run(), delayMs);
      cleanups.push(() => window.clearTimeout(timerId));
    }

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [tripleLinked]);

  return null;
}
