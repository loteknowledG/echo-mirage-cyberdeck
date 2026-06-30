/** Broadcast when any Spy link changes so the team status bar refreshes. */
export const SPY_TEAM_STATUS_CHANGED_EVENT = "echo-mirage-spy-team-status-changed";

export type SpyTeamLinkState = "linked" | "not-linked" | "terminated" | "unknown";

export type SpyTeamLink = {
  state: SpyTeamLinkState;
  detail: string | null;
};

export type SpyTeamStatus = {
  echoMirage: SpyTeamLink;
  echoPowerfist: SpyTeamLink;
  miragePowerfist: SpyTeamLink;
  echoHost: string | null;
  loading: boolean;
};

export function notifySpyTeamStatusChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPY_TEAM_STATUS_CHANGED_EVENT));
}

export function linkFromBool(linked: boolean, detail: string | null): SpyTeamLink {
  return {
    state: linked ? "linked" : "not-linked",
    detail,
  };
}

export function terminatedLink(message: string | null): SpyTeamLink {
  return { state: "terminated", detail: message };
}

export const EMPTY_SPY_TEAM_STATUS: SpyTeamStatus = {
  echoMirage: { state: "unknown", detail: null },
  echoPowerfist: { state: "unknown", detail: null },
  miragePowerfist: { state: "unknown", detail: null },
  echoHost: null,
  loading: true,
};
