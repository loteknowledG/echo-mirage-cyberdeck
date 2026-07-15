export const SURVEY_EXTENSION_PAGE_CONTEXT_EVENT = "echo-mirage:survey-extension-page-context";

/** window.postMessage type — CSP-safe bridge from extension content script. */
export const SURVEY_EXTENSION_PAGE_CONTEXT_MESSAGE_TYPE =
  "echo-mirage:survey-extension-page-context";

export const SURVEY_EXTENSION_MAX_PAGE_TEXT_CHARS = 12000;

export type SurveyExtensionPageSnapshot = {
  url: string;
  title: string;
  pageText: string;
  capturedAt: string;
  source?: string;
};

/** Chrome tab row for mirage-browser picker (from echo-extension via echo-electron). */
export type SurveyExtensionTabOption = {
  tabId: number;
  title: string;
  url: string;
  distinguisher: string;
  label: string;
};
