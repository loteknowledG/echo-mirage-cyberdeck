"use client";

/** @deprecated Import from survey-hub.client.ts */
export {
  SURVEY_AUTO_PAIR_REQUEST_EVENT,
  SURVEY_HUB_CONNECT_REQUEST_EVENT,
  formatSurveyAutoPairResultForMuthur,
  formatSurveyHubResultForMuthur,
  runSurveyAutoPair,
  runSurveyHubConnect,
  type SurveyAutoPairResult,
  type SurveyAutoPairStep,
  type SurveyHubConnectResult,
  type SurveyHubConnectStep,
} from "@/lib/cyberdeck/survey-hub.client";

export { isSurveyTripleLinked } from "@/lib/cyberdeck/survey-team-status-store.client";
