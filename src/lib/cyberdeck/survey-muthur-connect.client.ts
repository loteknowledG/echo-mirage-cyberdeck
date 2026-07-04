"use client";

import { formatSurveyHubResultForMuthur } from "@/lib/cyberdeck/survey-hub-connect-events";
import { requestSurveyHubConnectAndWait } from "@/lib/cyberdeck/survey-connect-request.client";
import { parseSurveyAutoConnectIntent } from "@/lib/cyberdeck/survey-auto-connect-intent";

export function surveyAutoConnectFailureMessage(err: unknown): string {
  return `SURVEY AUTO-CONNECT // FAILED // ${err instanceof Error ? err.message : "pairing failed"}`;
}

export async function executeSurveyHubConnectForMuthur(force: boolean): Promise<string> {
  const pairResult = await requestSurveyHubConnectAndWait({ force });
  return formatSurveyHubResultForMuthur(pairResult);
}

/** Returns MUTHUR system line when user message is a connect intent; null otherwise. */
export async function tryExecuteSurveyAutoConnectFromChat(
  userMessage: string,
): Promise<string | null> {
  if (!parseSurveyAutoConnectIntent(userMessage)) return null;
  return executeSurveyHubConnectForMuthur(true);
}
