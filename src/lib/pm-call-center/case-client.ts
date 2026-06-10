import type { PmCallEpisodeDigest, PmCallTurn } from "@/lib/pm-call-center/types";
import type { CaseMatchCandidate, PersistedCallRecord } from "@/lib/property-manager/cases/types";

export async function fetchPmCaseMatches(scenarioId: string): Promise<{
  matches: CaseMatchCandidate[];
  bestMatch: CaseMatchCandidate | null;
}> {
  const response = await fetch(`/api/pm-cases/match?scenarioId=${encodeURIComponent(scenarioId)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  const data = await response.json();
  return {
    matches: Array.isArray(data.matches) ? data.matches : [],
    bestMatch: data.bestMatch ?? null,
  };
}

export async function persistPmCallRecord(opts: {
  scenarioId: string;
  turns: PmCallTurn[];
  digest: PmCallEpisodeDigest;
  startedAt: number;
  endedAt: number;
  attachCaseSlug?: string;
}): Promise<PersistedCallRecord> {
  const response = await fetch("/api/pm-cases/persist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    callId: data.callId,
    caseId: data.caseId,
    caseSlug: data.caseSlug,
    folderRelative: data.folderRelative,
    createdCase: Boolean(data.createdCase),
    matchedExistingCase: Boolean(data.matchedExistingCase),
  };
}
