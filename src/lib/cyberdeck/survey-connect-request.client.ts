"use client";

import {
  SURVEY_HUB_CONNECT_REQUEST_EVENT,
  SURVEY_HUB_CONNECT_RESULT_EVENT,
  type SurveyHubConnectRequestDetail,
  type SurveyHubConnectResult,
} from "@/lib/cyberdeck/survey-hub-connect-events";

/** Fire-and-forget — handled by SurveyAutoPairHost. */
export function requestSurveyHubConnect(detail?: SurveyHubConnectRequestDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SURVEY_HUB_CONNECT_REQUEST_EVENT, {
      detail: detail ?? { force: true },
    }),
  );
}

/** @deprecated use requestSurveyHubConnect */
export const requestSurveyAutoPair = requestSurveyHubConnect;

const DEFAULT_CONNECT_WAIT_MS = 120_000;

/** Dispatch connect to SurveyAutoPairHost and resolve when the host posts a result. */
export function requestSurveyHubConnectAndWait(
  options?: SurveyHubConnectRequestDetail & { timeoutMs?: number },
): Promise<SurveyHubConnectResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ran: false, skipped: "Not in browser.", steps: [] });
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_CONNECT_WAIT_MS;

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(SURVEY_HUB_CONNECT_RESULT_EVENT, onResult);
      reject(new Error("Survey Hub connect timed out."));
    }, timeoutMs);

    const onResult = (event: Event) => {
      window.clearTimeout(timer);
      window.removeEventListener(SURVEY_HUB_CONNECT_RESULT_EVENT, onResult);
      resolve((event as CustomEvent<SurveyHubConnectResult>).detail);
    };

    window.addEventListener(SURVEY_HUB_CONNECT_RESULT_EVENT, onResult);
    requestSurveyHubConnect({
      force: options?.force ?? true,
      quiet: options?.quiet,
    });
  });
}
