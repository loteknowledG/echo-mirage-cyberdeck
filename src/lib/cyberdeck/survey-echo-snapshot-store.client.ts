"use client";

import type { EchoSurveyStatus } from "@/lib/cyberdeck/survey-pairing-client";

export const SURVEY_ECHO_SNAPSHOT_CHANGED_EVENT = "echo-mirage-survey-echo-snapshot-changed";

export type SurveyEchoSnapshot =
  | { ok: true; status: EchoSurveyStatus }
  | { ok: false; reason: string };

let snapshot: SurveyEchoSnapshot = { ok: false, reason: "Not loaded." };

export function getSurveyEchoSnapshot(): SurveyEchoSnapshot {
  return snapshot;
}

export function applySurveyEchoSnapshot(next: SurveyEchoSnapshot): void {
  snapshot = next;
}

export function notifySurveyEchoSnapshotChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_ECHO_SNAPSHOT_CHANGED_EVENT));
}
