import type { MuthurSurveyAutoConnectRef } from "@/lib/muthur-core/types";

export function extractSurveyAutoConnectRef(output: unknown): MuthurSurveyAutoConnectRef | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (record.queued !== true) return null;

  const force = record.force !== false;
  const echoHost = typeof record.echoHost === "string" ? record.echoHost.trim() : undefined;
  const echoHttpPort =
    typeof record.echoHttpPort === "number" && Number.isFinite(record.echoHttpPort)
      ? record.echoHttpPort
      : undefined;

  return { force, echoHost, echoHttpPort };
}

export function parseSurveyAutoConnectJson(
  raw: string | null | undefined,
): MuthurSurveyAutoConnectRef | null {
  if (!raw?.trim()) return null;
  try {
    return extractSurveyAutoConnectRef(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
