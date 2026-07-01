/** Echo Mirage Survey Mode — 3-device team: Echo + Mirage + PowerFist (phone). */

export type SurveyNodeRole = "echo" | "mirage" | "off";

/** Survey tab internal sub-panes: Echo, Mirage, PowerFist. */
export type SurveySubPane = "echo" | "mirage" | "powerfist";

export const SURVEY_MODE_STORAGE_KEY = "echo-mirage-survey-role";
export const SURVEY_NODE_ID_STORAGE_KEY = "echo-mirage-survey-node-id";

/** Capture desk — screenshot of the question on Echo. */
export const SURVEY_ROLE_ECHO: SurveyNodeRole = "echo";

/** Solver hub — MUTHUR generates the answer from Echo's capture. */
export const SURVEY_ROLE_MIRAGE: SurveyNodeRole = "mirage";

export const SURVEY_ECHO_NODE_LABEL = "echo";
export const SURVEY_MIRAGE_NODE_LABEL = "mirage";
export const SURVEY_POWERFIST_LABEL = "powerfist";
export const SURVEY_POWERFIST_DISPLAY = "POWERFIST";
/** Shown in team status — role hint, not a rename. */
export const SURVEY_POWERFIST_HINT = "phone";

export const SURVEY_MODE_TITLE = "SURVEY MODE";
export const SURVEY_MODE_SHORT = "Survey";

export const SURVEY_ECHO_DISPLAY = "ECHO";
export const SURVEY_MIRAGE_DISPLAY = "MIRAGE";

export const SURVEY_ECHO_TAGLINE =
  "Capture desk — screenshot the question on this machine.";
export const SURVEY_MIRAGE_TAGLINE = "Answer desk — MUTHUR solves from Echo's capture.";
export const SURVEY_POWERFIST_TAGLINE = "Phone trigger — PowerFist starts the mission.";

/** Shown on Mirage/PowerFist when Echo closes its Survey tab. */
export const ECHO_SURVEY_TERMINATED_MESSAGE = "ECHO TERMINATED";

/** Same-browser broadcast when Echo Survey session ends. */
export const SURVEY_ECHO_LINK_CHANNEL = "echo-mirage-survey-echo-link";

export function surveyRoleLabel(role: SurveyNodeRole): string {
  switch (role) {
    case "echo":
      return SURVEY_ECHO_DISPLAY;
    case "mirage":
      return SURVEY_MIRAGE_DISPLAY;
    case "off":
      return "OFF";
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function getOrCreateSurveyNodeId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(SURVEY_NODE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SURVEY_NODE_ID_STORAGE_KEY, created);
  return created;
}

export function readSurveyNodeRole(): SurveyNodeRole {
  if (typeof window === "undefined") return "off";
  const raw = window.localStorage.getItem(SURVEY_MODE_STORAGE_KEY)?.trim();
  if (raw === "echo" || raw === "mirage") return raw;
  return "off";
}

export function writeSurveyNodeRole(role: SurveyNodeRole): void {
  if (typeof window === "undefined") return;
  if (role === "off") {
    window.localStorage.removeItem(SURVEY_MODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SURVEY_MODE_STORAGE_KEY, role);
}

export function surveyTeamSummary(role: SurveyNodeRole): string {
  if (role === "echo") {
    return `${SURVEY_MODE_TITLE} // ${SURVEY_ECHO_DISPLAY} — pair with ${SURVEY_MIRAGE_DISPLAY}, then wait for PowerFist capture missions.`;
  }
  if (role === "mirage") {
    return `${SURVEY_MODE_TITLE} // ${SURVEY_MIRAGE_DISPLAY} — hub for ${SURVEY_ECHO_DISPLAY} + PowerFist; answers land here in MUTHUR.`;
  }
  return `${SURVEY_MODE_TITLE} — assign this machine as ${SURVEY_ECHO_DISPLAY} or ${SURVEY_MIRAGE_DISPLAY}.`;
}
