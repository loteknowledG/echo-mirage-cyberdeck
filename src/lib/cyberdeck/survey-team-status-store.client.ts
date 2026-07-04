"use client";

import {
  EMPTY_SURVEY_TEAM_STATUS,
  isSurveyTeamTripleLinked,
  type SurveyTeamStatus,
} from "@/lib/cyberdeck/survey-team-status";
import { probeSurveyTeamStatus } from "@/lib/cyberdeck/survey-team-status-probe.client";

let snapshot: SurveyTeamStatus = { ...EMPTY_SURVEY_TEAM_STATUS };

export function getSurveyTeamStatusSnapshot(): SurveyTeamStatus {
  return snapshot;
}

export function applySurveyTeamStatusSnapshot(status: SurveyTeamStatus): void {
  snapshot = status;
}

export function isSurveyTripleLinkedSync(): boolean {
  return isSurveyTeamTripleLinked(snapshot);
}

/** Refresh team link probes and update the shared snapshot. */
export async function refreshSurveyTeamStatus(): Promise<SurveyTeamStatus> {
  const status = await probeSurveyTeamStatus();
  applySurveyTeamStatusSnapshot(status);
  return status;
}

/** True when Echo↔Mirage, Echo↔PowerFist, and Mirage↔PowerFist hub are all active. */
export async function isSurveyTripleLinked(): Promise<boolean> {
  const status = await refreshSurveyTeamStatus();
  return isSurveyTeamTripleLinked(status);
}
