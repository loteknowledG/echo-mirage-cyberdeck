/** Survey Hub connect events + result types — safe for cyberdeck-app (no pairing imports). */

export const SURVEY_HUB_CONNECT_REQUEST_EVENT = "echo-mirage:survey-hub-connect-request";
/** @deprecated use SURVEY_HUB_CONNECT_REQUEST_EVENT */
export const SURVEY_AUTO_PAIR_REQUEST_EVENT = SURVEY_HUB_CONNECT_REQUEST_EVENT;

export const SURVEY_HUB_CONNECT_RESULT_EVENT = "echo-mirage:survey-hub-connect-result";

export type SurveyHubConnectStep = {
  id: "mirage" | "powerfist-echo" | "powerfist-hub";
  ok: boolean;
  detail: string;
};

export type SurveyHubConnectResult = {
  ran: boolean;
  skipped?: string;
  steps: SurveyHubConnectStep[];
  echoNodeId?: string | null;
};

export type SurveyHubConnectRequestDetail = {
  force?: boolean;
  quiet?: boolean;
};

export type SurveyAutoPairResult = SurveyHubConnectResult;
export type SurveyAutoPairStep = SurveyHubConnectStep;

export function formatSurveyHubResultForMuthur(result: SurveyHubConnectResult): string {
  if (!result.ran) {
    return `SURVEY HUB // SKIPPED // ${result.skipped ?? "not run"}`;
  }

  const lines = result.steps.map(
    (step) => `${step.id.toUpperCase()} // ${step.ok ? "OK" : "FAIL"} // ${step.detail}`,
  );
  const failed = result.steps.filter((step) => !step.ok).length;
  const header =
    failed === 0
      ? "SURVEY HUB // CONNECTED // all TEAM LINKS green"
      : `SURVEY HUB // PARTIAL // ${failed} link(s) need attention`;

  const teamLine = result.echoNodeId ? `TEAM ID // ${result.echoNodeId}` : null;
  return [header, teamLine, ...lines].filter(Boolean).join("\n");
}

/** @deprecated use formatSurveyHubResultForMuthur */
export function formatSurveyAutoPairResultForMuthur(result: SurveyAutoPairResult): string {
  return formatSurveyHubResultForMuthur(result);
}

export function dispatchSurveyHubConnectResult(result: SurveyHubConnectResult): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_HUB_CONNECT_RESULT_EVENT, { detail: result }));
}
