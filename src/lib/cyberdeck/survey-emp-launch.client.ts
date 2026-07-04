"use client";

import type { SurveySubPane } from "@/lib/cyberdeck/survey-mode";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";

export const SURVEY_EMP_QUERY_KEY = "surveyEmp";
export const SURVEY_EMP_CONNECT_QUERY_KEY = "surveyEmpConnect";
export const SURVEY_EMP_SUBPANE_EVENT = "echo-mirage:survey-emp-subpane";

const EMP_HUB_CONNECT_SESSION_KEY = "echo-mirage:survey-emp-hub-connect";
const EMP_POWERFIST_HUB_RESTORE_KEY = "echo-mirage:survey-emp-powerfist-hub-restore";

const VALID_SUBPANES = new Set<SurveySubPane>(["echo", "mirage", "powerfist"]);

export function parseSurveyEmpSubPane(raw: string | null | undefined): SurveySubPane | null {
  const value = raw?.trim().toLowerCase();
  if (!value || !VALID_SUBPANES.has(value as SurveySubPane)) return null;
  return value as SurveySubPane;
}

export function parseSurveyEmpSubPaneFromLocation(
  location: Pick<Location, "search"> = typeof window !== "undefined" ? window.location : { search: "" },
): SurveySubPane | null {
  return parseSurveyEmpSubPane(new URLSearchParams(location.search).get(SURVEY_EMP_QUERY_KEY));
}

export function dispatchSurveyEmpSubPane(subPane: SurveySubPane): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_EMP_SUBPANE_EVENT, { detail: { subPane } }));
}

/** Ensure a Survey custom tab exists and is selected (EMP dev ignition). */
export function ensureSurveyTabSelected(): void {
  const store = useCyberdeckTabStore.getState();
  const existing = store.customTabs.find((tab) => tab.kind === "survey");
  if (existing) {
    store.selectTab(existing.id, true);
    return;
  }

  const id = `tab-survey-emp-${crypto.randomUUID().slice(0, 8)}`;
  store.setCustomTabs((prev) => [
    ...prev,
    {
      id,
      label: "Survey",
      glyph: "◉",
      kind: "survey",
      asset: null,
    },
  ]);
  store.selectTab(id, true);
}

export function shouldTriggerEmpHubConnectFromUrl(
  location: Pick<Location, "search"> = typeof window !== "undefined" ? window.location : { search: "" },
): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get(SURVEY_EMP_CONNECT_QUERY_KEY) === "0") return false;
  const subPane = parseSurveyEmpSubPane(params.get(SURVEY_EMP_QUERY_KEY));
  return subPane === "mirage" || subPane === "powerfist";
}

export function isEmpMirageHubConnectSurface(
  location: Pick<Location, "search"> = typeof window !== "undefined" ? window.location : { search: "" },
): boolean {
  return parseSurveyEmpSubPaneFromLocation(location) === "mirage";
}

export function isEmpPowerfistHubRestoreSurface(
  location: Pick<Location, "search"> = typeof window !== "undefined" ? window.location : { search: "" },
): boolean {
  return parseSurveyEmpSubPaneFromLocation(location) === "powerfist";
}

/** Mirage window — full Hub connect burst once per session (EMP ignition). */
export function markEmpHubConnectTriggered(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(EMP_HUB_CONNECT_SESSION_KEY) === "1") return false;
  window.sessionStorage.setItem(EMP_HUB_CONNECT_SESSION_KEY, "1");
  return true;
}

/** PowerFist EMP window — hub restore burst once per session. */
export function markEmpPowerfistHubRestoreTriggered(): boolean {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(EMP_POWERFIST_HUB_RESTORE_KEY) === "1") return false;
  window.sessionStorage.setItem(EMP_POWERFIST_HUB_RESTORE_KEY, "1");
  return true;
}

export function applySurveyEmpLaunchFromUrl(): SurveySubPane | null {
  const subPane = parseSurveyEmpSubPaneFromLocation();
  if (!subPane) return null;
  ensureSurveyTabSelected();
  dispatchSurveyEmpSubPane(subPane);
  return subPane;
}
