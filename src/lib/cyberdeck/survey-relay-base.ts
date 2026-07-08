/** Resolve Survey cloud relay base URL (empty = use Next in-app routes). */

export function resolveSurveyRelayBaseUrl(): string {
  const fromEnv =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SURVEY_RELAY_BASE_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.SURVEY_RELAY_BASE_URL?.trim()) ||
    "";
  return fromEnv.replace(/\/$/, "");
}

export function surveyRelayPath(path: string): string {
  const base = resolveSurveyRelayBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalized;
  return `${base}${normalized}`;
}
