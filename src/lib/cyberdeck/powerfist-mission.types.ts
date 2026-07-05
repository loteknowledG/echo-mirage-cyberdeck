/** Echo Mirage Survey Mode — phone PowerFist → Echo capture → Mirage solve. */

export type SurveyMissionKind = "silent-capture-solve";

/** @deprecated use SurveyMissionKind */
export type PowerfistMissionKind = SurveyMissionKind;

export type SurveyMissionEnvelope = {
  type: "mission";
  missionId: string;
  kind: SurveyMissionKind;
  /** Mirage desk HTTP — Echo POSTs PNG here. */
  ingestUrl: string;
  missionSecret: string;
  prompt: string;
};

/** @deprecated use SurveyMissionEnvelope */
export type PowerfistMissionEnvelope = SurveyMissionEnvelope;

export type SurveyMissionSolveDetail = {
  missionId: string;
  kind: SurveyMissionKind;
  imageDataUrl: string;
  prompt: string;
};

/** @deprecated use SurveyMissionSolveDetail */
export type PowerfistMissionSolveDetail = SurveyMissionSolveDetail;

export const SURVEY_MISSION_SOLVE_EVENT = "echo-mirage:survey-mission-solve";

/** @deprecated use SURVEY_MISSION_SOLVE_EVENT */
export const POWERFIST_MISSION_SOLVE_EVENT = SURVEY_MISSION_SOLVE_EVENT;

export const SURVEY_SILENT_CAPTURE_PROMPT =
  "Analyze the coding question in the attached screenshot from Echo. Provide a clear explanation and working code solution. Be concise and interview-ready.";

export const SURVEY_SELECTED_TEXT_PROMPT =
  "Analyze this coding problem or selected text from Echo. Provide a clear explanation and working code solution. Be concise and interview-ready.";

/** @deprecated use SURVEY_SILENT_CAPTURE_PROMPT */
export const SILENT_CAPTURE_SOLVE_PROMPT = SURVEY_SILENT_CAPTURE_PROMPT;