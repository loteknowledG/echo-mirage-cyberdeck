/** Broadcast when any Survey team link changes so the team status bar refreshes. */
export const SURVEY_TEAM_STATUS_CHANGED_EVENT = "echo-mirage-survey-team-status-changed";

/** @deprecated listen via SURVEY_TEAM_STATUS_CHANGED_EVENT — still dispatched for one release */
export const LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT = "echo-mirage-spy-team-status-changed";

export type SurveyTeamLinkState = "linked" | "not-linked" | "terminated" | "unknown";

export type SurveyTeamLink = {
  state: SurveyTeamLinkState;
  detail: string | null;
};

export type SurveyTeamStatus = {
  echoMirage: SurveyTeamLink;
  echoPowerfist: SurveyTeamLink;
  miragePowerfist: SurveyTeamLink;
  echoHost: string | null;
  loading: boolean;
};

export function notifySurveyTeamStatusChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_TEAM_STATUS_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent(LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT));
}

export function linkFromBool(linked: boolean, detail: string | null): SurveyTeamLink {
  return {
    state: linked ? "linked" : "not-linked",
    detail,
  };
}

export function terminatedLink(message: string | null): SurveyTeamLink {
  return { state: "terminated", detail: message };
}

export const EMPTY_SURVEY_TEAM_STATUS: SurveyTeamStatus = {
  echoMirage: { state: "unknown", detail: null },
  echoPowerfist: { state: "unknown", detail: null },
  miragePowerfist: { state: "unknown", detail: null },
  echoHost: null,
  loading: true,
};

export function isSurveyTeamTripleLinked(
  team: Pick<SurveyTeamStatus, "echoMirage" | "echoPowerfist" | "miragePowerfist" | "loading">,
): boolean {
  if (team.loading) return false;
  return (
    team.echoMirage.state === "linked" &&
    team.echoPowerfist.state === "linked" &&
    team.miragePowerfist.state === "linked"
  );
}
