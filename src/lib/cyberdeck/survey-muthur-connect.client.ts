"use client";

import { formatSurveyHubResultForMuthur } from "@/lib/cyberdeck/survey-hub-connect-events";
import { requestSurveyHubConnectAndWait } from "@/lib/cyberdeck/survey-connect-request.client";
import { parseSurveyAutoConnectIntent } from "@/lib/cyberdeck/survey-auto-connect-intent";
import { runSurveyMiragePowerfistHubRestore } from "@/lib/cyberdeck/survey-hub.client";
import { recordSurveyHubRestoreDiagnostic } from "@/lib/cyberdeck/survey-hub-diagnostics.client";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { refreshSurveyTeamStatus } from "@/lib/cyberdeck/survey-team-status-store.client";

export function surveyAutoConnectFailureMessage(err: unknown): string {
  return `SURVEY AUTO-CONNECT // FAILED // ${err instanceof Error ? err.message : "pairing failed"}`;
}

export async function executeSurveyHubConnectForMuthur(force: boolean): Promise<string> {
  const pairResult = await requestSurveyHubConnectAndWait({ force });
  const lines: string[] = [formatSurveyHubResultForMuthur(pairResult)];

  let team = await refreshSurveyTeamStatus();
  if (!isSurveyTeamTripleLinked(team)) {
    const hubRestore = await runSurveyMiragePowerfistHubRestore({ quiet: true });
    recordSurveyHubRestoreDiagnostic({
      ok: hubRestore.ok,
      detail: hubRestore.detail,
      source: "muthur",
    });
    team = await refreshSurveyTeamStatus();
    lines.push(`HUB-RESTORE // ${hubRestore.ok ? "OK" : "FAIL"} // ${hubRestore.detail}`);
  }

  if (isSurveyTeamTripleLinked(team)) {
    lines.push("SURVEY HUB // SQUAD LINKED // all TEAM LINKS green");
  } else if (team.miragePowerfist.state !== "linked") {
    lines.push(
      "HUB DIAG // Mirage ↔ PowerFist still pending — open PowerFist (p) sub-pane or Retry connect on TEAM LINKS.",
    );
  }

  return lines.join("\n");
}

/** Returns MUTHUR system line when user message is a connect intent; null otherwise. */
export async function tryExecuteSurveyAutoConnectFromChat(
  userMessage: string,
): Promise<string | null> {
  if (!parseSurveyAutoConnectIntent(userMessage)) return null;
  return executeSurveyHubConnectForMuthur(true);
}
