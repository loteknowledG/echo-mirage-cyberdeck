/** Fire-and-forget pairing trace lines — consumed by survey-pairing-debug for MUTHUR chat. */

export const SURVEY_PAIRING_TRACE_EVENT = "echo-mirage:survey-pairing-trace";

export function traceSurveyPairing(text: string): void {
  const line = text.trim();
  if (!line || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_PAIRING_TRACE_EVENT, { detail: { text: line } }));
}
