import { terminateEchoSurveySession } from "@/lib/cyberdeck/survey-pairing-client";

export function terminateSurveySessionWhenTabClosed(tabKind: string | undefined): void {
  if (tabKind === "survey") {
    void terminateEchoSurveySession();
  }
}

export function terminateSurveySessionWhenTabsCleared(tabs: Array<{ kind: string }>): void {
  if (tabs.some((tab) => tab.kind === "survey")) {
    void terminateEchoSurveySession();
  }
}
