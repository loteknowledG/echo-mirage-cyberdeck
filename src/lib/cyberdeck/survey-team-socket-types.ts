export const SURVEY_TEAM_SOCKET_PATH = "/survey-team";

export const SURVEY_PAIRING_BUNDLE_EVENT = "echo-mirage-survey-pairing-bundle";
export const SURVEY_TEAM_SOCKET_STATUS_EVENT = "echo-mirage-survey-team-socket-status";

export type SurveyTeamSocketRole = "mirage" | "powerfist";

export type SurveyTeamSocketStatus = "idle" | "connecting" | "connected" | "error" | "disabled";

export type SurveyPairingBundlePush = {
  echoHost: string;
  httpPort: number;
  miragePin: string;
  powerfistPin?: string;
  mirageUrl?: string | null;
  echoNodeId?: string | null;
  sessionEpoch?: number | null;
  sentAt?: string;
};

export type SurveyTeamRoster = {
  echo: boolean;
  mirages: string[];
  powerfists: string[];
  memberCount: number;
};

export type SurveyTeamLinkedNotice = {
  role: SurveyTeamSocketRole | "echo";
  nodeId?: string | null;
  deviceId?: string | null;
  at?: string;
};

export type SurveyMirageQueueControlPayload = {
  control: { action: "select" | "next" | "prev"; index?: number };
  source: "mirage" | "powerfist";
  clientId?: string;
};
