// SERVER ONLY — HTTP bridge to external Go PowerFist hub.

import type { SurveyMissionEnvelope, SurveyMissionSolveDetail } from "@/lib/cyberdeck/powerfist-mission.types";

export function powerfistExternalHubHttp(): string | null {
  const raw = process.env.ECHO_MIRAGE_POWERFIST_HUB_HTTP?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function powerfistExternalHubEnabled(): boolean {
  if (powerfistExternalHubHttp()) return true;
  return process.env.ECHO_MIRAGE_POWERFIST_EXTERNAL_HUB?.trim() === "1";
}

export async function broadcastPowerfistMissionSolveExternal(
  detail: SurveyMissionSolveDetail,
): Promise<number | null> {
  const hub = powerfistExternalHubHttp();
  if (!hub) return null;
  try {
    const res = await fetch(`${hub}/api/powerfist/internal/mission-solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detail),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return 0;
    const payload = (await res.json()) as { delivered?: number };
    return payload.delivered ?? 0;
  } catch {
    return 0;
  }
}

export async function broadcastPowerfistMissionToCaptureExternal(
  envelope: SurveyMissionEnvelope,
): Promise<number | null> {
  const hub = powerfistExternalHubHttp();
  if (!hub) return null;
  try {
    const res = await fetch(`${hub}/api/powerfist/internal/mission-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return 0;
    const payload = (await res.json()) as { delivered?: number };
    return payload.delivered ?? 0;
  } catch {
    return 0;
  }
}

export async function waitForExternalPowerfistHubHealth(): Promise<boolean> {
  const hub = powerfistExternalHubHttp();
  if (!hub) return false;
  try {
    const res = await fetch(`${hub}/healthz`, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}
