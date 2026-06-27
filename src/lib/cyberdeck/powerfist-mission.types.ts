/** Echo Mirage Espionage Mode — phone PowerFist → Echo capture → Mirage solve. */

export type EspionageMissionKind = "silent-capture-solve";

/** @deprecated use EspionageMissionKind */
export type PowerfistMissionKind = EspionageMissionKind;

export type EspionageMissionEnvelope = {
  type: "mission";
  missionId: string;
  kind: EspionageMissionKind;
  /** Mirage desk HTTP — Echo POSTs PNG here. */
  ingestUrl: string;
  missionSecret: string;
  prompt: string;
};

/** @deprecated use EspionageMissionEnvelope */
export type PowerfistMissionEnvelope = EspionageMissionEnvelope;

export type EspionageMissionSolveDetail = {
  missionId: string;
  kind: EspionageMissionKind;
  imageDataUrl: string;
  prompt: string;
};

/** @deprecated use EspionageMissionSolveDetail */
export type PowerfistMissionSolveDetail = EspionageMissionSolveDetail;

export const ESPIONAGE_MISSION_SOLVE_EVENT = "echo-mirage:espionage-mission-solve";

/** @deprecated use ESPIONAGE_MISSION_SOLVE_EVENT */
export const POWERFIST_MISSION_SOLVE_EVENT = ESPIONAGE_MISSION_SOLVE_EVENT;

export const ESPIONAGE_SILENT_CAPTURE_PROMPT =
  "Analyze the coding question in the attached screenshot from Echo. Provide a clear explanation and working code solution. Be concise and interview-ready.";

/** @deprecated use ESPIONAGE_SILENT_CAPTURE_PROMPT */
export const SILENT_CAPTURE_SOLVE_PROMPT = ESPIONAGE_SILENT_CAPTURE_PROMPT;