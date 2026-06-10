import type { ScenarioCaseContext } from "@/lib/property-manager/cases/scenario-context";
import { buildLookupKey } from "@/lib/property-manager/cases/scenario-context";
import { listCaseRecords } from "@/lib/property-manager/cases/store.server";
import type { CaseMatchCandidate, PropertyCase } from "@/lib/property-manager/cases/types";

const CLOSED_STATUSES = new Set<PropertyCase["status"]>(["closed", "resolved"]);

function isOpenCase(caseRecord: PropertyCase): boolean {
  return !CLOSED_STATUSES.has(caseRecord.status);
}

function scoreCaseMatch(caseRecord: PropertyCase, ctx: ScenarioCaseContext): CaseMatchCandidate | null {
  if (!isOpenCase(caseRecord)) return null;

  const lookupKey = buildLookupKey(ctx);
  const sameOperationalCase =
    caseRecord.lookup.key === lookupKey ||
    (
      caseRecord.propertyId === ctx.propertyId &&
      caseRecord.unitId === ctx.unitId &&
      caseRecord.category === ctx.category &&
      caseRecord.issue === ctx.issue
    );

  if (!sameOperationalCase) return null;

  const reasons: string[] = [];
  let score = 0;

  if (ctx.residentPhone && caseRecord.residentPhone === ctx.residentPhone) {
    score += 5;
    reasons.push("resident_phone");
  }

  if (caseRecord.propertyId === ctx.propertyId) {
    score += 2;
    reasons.push("property");
  }

  if (caseRecord.unitId === ctx.unitId) {
    score += 2;
    reasons.push("unit");
  }

  if (caseRecord.category === ctx.category) {
    score += 1;
    reasons.push("category");
  }

  if (caseRecord.issue === ctx.issue) {
    score += 2;
    reasons.push("issue");
  }

  if (caseRecord.lookup.key === lookupKey) {
    score += 3;
    reasons.push("lookup_key");
  }

  const tagSet = new Set(caseRecord.lookup.tags);
  for (const tag of [`property:${ctx.propertyId}`, `unit:${ctx.unitId}`, `category:${ctx.category}`, `issue:${ctx.issue}`]) {
    if (tagSet.has(tag)) {
      score += 1;
      reasons.push(`tag:${tag}`);
    }
  }

  if (score < 4) return null;

  return {
    caseId: caseRecord.id,
    slug: caseRecord.slug,
    title: caseRecord.title,
    status: caseRecord.status,
    severity: caseRecord.severity,
    callCount: caseRecord.callIds.length,
    matchReasons: [...new Set(reasons)],
  };
}

export async function findMatchingOpenCases(
  ctx: ScenarioCaseContext,
): Promise<CaseMatchCandidate[]> {
  const cases = await listCaseRecords();
  const matches = cases
    .map((caseRecord) => scoreCaseMatch(caseRecord, ctx))
    .filter((match): match is CaseMatchCandidate => match !== null)
    .sort((a, b) => b.matchReasons.length - a.matchReasons.length);

  return matches;
}

export async function findBestMatchingOpenCase(
  ctx: ScenarioCaseContext,
): Promise<CaseMatchCandidate | null> {
  const matches = await findMatchingOpenCases(ctx);
  return matches[0] ?? null;
}
