"use client";

import { createBackgroundPoll } from "@/lib/client/background-poll.client";
import { requestSurveyHubConnect } from "@/lib/cyberdeck/survey-connect-request.client";
import {
  applySurveyEchoSnapshot,
  notifySurveyEchoSnapshotChanged,
} from "@/lib/cyberdeck/survey-echo-snapshot-store.client";
import {
  refreshSurveyLinkWatch,
} from "@/lib/cyberdeck/survey-link-watch-store.client";
import {
  notifySurveyTeamStatusChanged,
  resolveSurveyTeamPollIntervalMs,
  SURVEY_TEAM_PAIRING_POLL_MS,
} from "@/lib/cyberdeck/survey-team-status";
import { probeSurveyTeamStatusDetailed } from "@/lib/cyberdeck/survey-team-status-probe.client";
import {
  applySurveyTeamStatusSnapshot,
  getSurveyTeamStatusSnapshot,
} from "@/lib/cyberdeck/survey-team-status-store.client";

async function runSurveyTeamStatusTick(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;

  const detailed = await probeSurveyTeamStatusDetailed();
  if (signal.aborted) return;

  applySurveyTeamStatusSnapshot(detailed.team);
  if (detailed.echo) {
    applySurveyEchoSnapshot({ ok: true, status: detailed.echo });
  } else {
    applySurveyEchoSnapshot({
      ok: false,
      reason: detailed.echoFetchFailedReason ?? "Could not load Echo Survey status.",
    });
  }

  await refreshSurveyLinkWatch((message) => {
    requestSurveyHubConnect({ force: true });
    void message;
  });
  if (signal.aborted) return;

  notifySurveyTeamStatusChanged();
  notifySurveyEchoSnapshotChanged();
}

export const surveyTeamStatusPoll = createBackgroundPoll({
  id: "survey-team-status",
  tick: runSurveyTeamStatusTick,
  getBaseIntervalMs: () => resolveSurveyTeamPollIntervalMs(getSurveyTeamStatusSnapshot()),
  minIntervalMs: SURVEY_TEAM_PAIRING_POLL_MS,
  maxBackoffMs: 5 * 60_000,
});

export function subscribeSurveyTeamStatusPoll(onNotify?: () => void): () => void {
  return surveyTeamStatusPoll.subscribe(onNotify);
}

export async function refreshSurveyTeamStatusPoll(): Promise<void> {
  await surveyTeamStatusPoll.refresh();
}

export function getSurveyTeamStatusPollState() {
  return surveyTeamStatusPoll.getState();
}
