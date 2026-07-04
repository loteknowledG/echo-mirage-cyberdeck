/**
 * Survey pairing barrel — re-exports split modules for backward compatibility.
 * Prefer importing from the focused modules directly in new code.
 */
export { ECHO_SURVEY_TERMINATED_MESSAGE } from "@/lib/cyberdeck/survey-mode";

export {
  clearSurveyMiragePairCredentials,
  clearSurveyPowerfistPairCredentials,
  getOrCreatePowerfistDeviceId,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  saveSurveyMiragePairCredentials,
  saveSurveyPowerfistPairCredentials,
  type SurveyMiragePairCredentials,
  type SurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pair-credentials.client";

export {
  fetchEchoRemoteSurveyCodesClient,
  fetchEchoRemoteSurveyStatusClient,
  fetchEchoSurveyCodes,
  fetchEchoSurveyLinkStatus,
  fetchEchoSurveyStatus,
  formatCodeExpiry,
  normalizePairedMirages,
  regenerateEchoSurveyCodes,
  type EchoSurveyStatus,
  type EchoSurveyStatusSource,
  type SurveyPairedMirage,
} from "@/lib/cyberdeck/survey-echo-status.client";

export {
  enterSurveyPairCode,
  enterSurveyPairPin,
} from "@/lib/cyberdeck/survey-pair-enter.client";

export {
  isSurveyHttpsPairBlocked,
  SURVEY_PWA_PAIR_BLOCKED_MESSAGE,
} from "@/lib/cyberdeck/survey-pairing-shared.client";

export {
  broadcastSurveyEchoTerminated,
  terminateEchoSurveySession,
} from "@/lib/cyberdeck/survey-session.client";
