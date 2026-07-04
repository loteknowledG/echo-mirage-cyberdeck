"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_SURVEY_TEAM_STATUS,
  LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT,
  SURVEY_TEAM_STATUS_CHANGED_EVENT,
  type SurveyTeamStatus,
} from "@/lib/cyberdeck/survey-team-status";
import {
  applySurveyTeamStatusSnapshot,
  getSurveyTeamStatusSnapshot,
} from "@/lib/cyberdeck/survey-team-status-store.client";
import { probeSurveyTeamStatus } from "@/lib/cyberdeck/survey-team-status-probe.client";

const REFRESH_MS = 3000;

export function useSurveyTeamStatus(): SurveyTeamStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<SurveyTeamStatus>(() => getSurveyTeamStatusSnapshot());

  const refresh = useCallback(async () => {
    const next = await probeSurveyTeamStatus();
    applySurveyTeamStatusSnapshot(next);
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    const onChanged = () => void refresh();
    window.addEventListener(SURVEY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    window.addEventListener(LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(SURVEY_TEAM_STATUS_CHANGED_EVENT, onChanged);
      window.removeEventListener(LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  return { ...status, refresh };
}
