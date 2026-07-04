"use client";

const SURVEY_HUB_TEAM_ID_KEY = "echo-mirage-survey-hub-team-id";

/** Persist Echo team ID — enter once, Survey Hub reuses it. */
export function readSurveyHubTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SURVEY_HUB_TEAM_ID_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function saveSurveyHubTeamId(echoNodeId: string): void {
  if (typeof window === "undefined") return;
  const id = echoNodeId.trim();
  if (!id) return;
  try {
    window.localStorage.setItem(SURVEY_HUB_TEAM_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearSurveyHubTeamId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SURVEY_HUB_TEAM_ID_KEY);
  } catch {
    /* ignore */
  }
}

/** Team ID from store, saved pair creds, or URL (?echoNodeId= / ?surveyTeamId=). */
export function resolveSurveyHubTeamId(preferred?: string | null): string | null {
  const direct = preferred?.trim();
  if (direct) return direct;

  const stored = readSurveyHubTeamId();
  if (stored) return stored;

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("echoNodeId")?.trim() || params.get("surveyTeamId")?.trim();
    if (fromUrl) return fromUrl;
  }

  return null;
}
