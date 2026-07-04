"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SURVEY_HUB_DIAGNOSTICS_CHANGED_EVENT,
  getSurveyHubDiagnosticsSnapshot,
  probeSurveyHubRelayDiagnostic,
  type SurveyHubDiagnosticsSnapshot,
} from "@/lib/cyberdeck/survey-hub-diagnostics.client";
import { SURVEY_TEAM_STATUS_CHANGED_EVENT } from "@/lib/cyberdeck/survey-team-status";

export function useSurveyHubDiagnostics(): SurveyHubDiagnosticsSnapshot & {
  refreshRelay: () => Promise<void>;
} {
  const [diagnostics, setDiagnostics] = useState<SurveyHubDiagnosticsSnapshot>(() =>
    getSurveyHubDiagnosticsSnapshot(),
  );

  const refreshRelay = useCallback(async () => {
    await probeSurveyHubRelayDiagnostic();
    setDiagnostics(getSurveyHubDiagnosticsSnapshot());
  }, []);

  useEffect(() => {
    const sync = () => setDiagnostics(getSurveyHubDiagnosticsSnapshot());

    sync();
    void refreshRelay();

    window.addEventListener(SURVEY_HUB_DIAGNOSTICS_CHANGED_EVENT, sync);
    window.addEventListener(SURVEY_TEAM_STATUS_CHANGED_EVENT, () => void refreshRelay());

    return () => {
      window.removeEventListener(SURVEY_HUB_DIAGNOSTICS_CHANGED_EVENT, sync);
    };
  }, [refreshRelay]);

  return { ...diagnostics, refreshRelay };
}
