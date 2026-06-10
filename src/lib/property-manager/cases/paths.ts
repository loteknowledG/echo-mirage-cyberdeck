import path from "node:path";

export const PM_CASES_ROOT_SEGMENTS = ["data", "property-manager", "cases"] as const;

export function pmCasesRootAbs(): string {
  return path.join(process.cwd(), ...PM_CASES_ROOT_SEGMENTS);
}

export function caseFolderAbs(slug: string): string {
  return path.join(pmCasesRootAbs(), slug);
}

export function callFolderAbs(caseSlug: string, callId: string): string {
  return path.join(caseFolderAbs(caseSlug), "calls", callId);
}

export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildCaseSlug(params: {
  year: number;
  sequence: number;
  propertyId: string;
  unitId: string;
  category: string;
  issue: string;
}): string {
  const parts = [
    `CASE-${params.year}-${params.sequence}`,
    slugifySegment(params.propertyId),
    slugifySegment(params.unitId),
    slugifySegment(params.category),
    slugifySegment(params.issue),
  ].filter(Boolean);
  return parts.join("-");
}

export function buildCaseId(year: number, sequence: number): string {
  return `CASE-${year}-${sequence}`;
}

export function buildCallId(endedAtMs: number): string {
  const d = new Date(endedAtMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `CALL-${yyyy}-${mm}-${dd}-${hh}${min}`;
}
