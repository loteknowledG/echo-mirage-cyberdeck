/** Echo Mirage Survey Mode — phone PowerFist → Echo capture → Mirage solve. */

export type SurveyMissionKind = "silent-capture-solve";

export type SurveyMissionEnvelope = {
  type: "mission";
  missionId: string;
  kind: SurveyMissionKind;
  /** Mirage desk HTTP — Echo POSTs PNG here. */
  ingestUrl: string;
  missionSecret: string;
  prompt: string;
};

export type SurveyMissionSolveDetail = {
  missionId: string;
  kind: SurveyMissionKind;
  imageDataUrl: string;
  prompt: string;
};

export const SURVEY_MISSION_SOLVE_EVENT = "echo-mirage:survey-mission-solve";

export const SURVEY_SILENT_CAPTURE_PROMPT =
  "Analyze the coding question in the attached screenshot from Echo. Provide a clear explanation and working code solution. Be concise and interview-ready.";

export const SURVEY_SELECTED_TEXT_PROMPT =
  "Analyze this coding problem or selected text from Echo. Provide a clear explanation and working code solution. Be concise and interview-ready.";
