import {
  terminateSurveySessionWhenTabClosed,
  terminateSurveySessionWhenTabsCleared,
} from "@/lib/cyberdeck/survey-tab-lifecycle.client";

/** Notify Survey when a custom tab closes (Echo-local session teardown). */
export function notifySurveyTabClosed(tabKind: string | undefined): void {
  terminateSurveySessionWhenTabClosed(tabKind);
}

/** Notify Survey when all custom tabs are cleared. */
export function notifySurveyTabsCleared(tabs: Array<{ kind: string }>): void {
  terminateSurveySessionWhenTabsCleared(tabs);
}
