"use client";

export type SurveyListeningSource = "echo" | "mirage";

export const SURVEY_LISTENING_SOURCE_CHANGED_EVENT =
  "echo-mirage-survey-listening-source-changed";

const STORAGE_KEY = "echo-mirage-survey-listening-source-v1";

let source: SurveyListeningSource = "echo";
let hydrated = false;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SURVEY_LISTENING_SOURCE_CHANGED_EVENT, { detail: { source } }),
  );
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "mirage" || raw === "echo") source = raw;
  } catch {
    /* ignore */
  }
}

export function readSurveyListeningSource(): SurveyListeningSource {
  hydrateFromStorage();
  return source;
}

export function setSurveyListeningSource(next: SurveyListeningSource): void {
  hydrateFromStorage();
  source = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
  }
  emit();
}

export function subscribeSurveyListeningSource(
  listener: (next: SurveyListeningSource) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener(readSurveyListeningSource());
  window.addEventListener(SURVEY_LISTENING_SOURCE_CHANGED_EVENT, handler);
  listener(readSurveyListeningSource());
  return () => window.removeEventListener(SURVEY_LISTENING_SOURCE_CHANGED_EVENT, handler);
}
