"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT,
  SURVEY_TEAM_STATUS_CHANGED_EVENT,
  type SurveyTeamStatus,
} from "@/lib/cyberdeck/survey-team-status";
import {
  refreshSurveyTeamStatusPoll,
  subscribeSurveyTeamStatusPoll,
} from "@/lib/cyberdeck/survey-team-status-poll.client";
import { getSurveyTeamStatusSnapshot } from "@/lib/cyberdeck/survey-team-status-store.client";

export function useSurveyTeamStatus(): SurveyTeamStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<SurveyTeamStatus>(() => getSurveyTeamStatusSnapshot());

  const sync = useCallback(() => {
    setStatus(getSurveyTeamStatusSnapshot());
  }, []);

  const refresh = useCallback(async () => {
    await refreshSurveyTeamStatusPoll();
    sync();
  }, [sync]);

  useEffect(() => {
    sync();
    const unsubPoll = subscribeSurveyTeamStatusPoll(sync);
    const onChanged = () => sync();
    window.addEventListener(SURVEY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    window.addEventListener(LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    return () => {
      unsubPoll();
      window.removeEventListener(SURVEY_TEAM_STATUS_CHANGED_EVENT, onChanged);
      window.removeEventListener(LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    };
  }, [sync]);

  return { ...status, refresh };
}
