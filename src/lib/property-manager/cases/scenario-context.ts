import type { PmCallEpisodeDigest, PmCallScenario } from "@/lib/pm-call-center/types";
import { slugifySegment } from "@/lib/property-manager/cases/paths";

export type ScenarioCaseContext = {
  propertyId: string;
  propertyName: string;
  unitId: string;
  residentName: string;
  residentPhone?: string;
  category: string;
  issue: string;
  title: string;
};

const SCENARIO_PHONES: Record<string, string> = {
  "leak-4b": "+1-555-0104",
  "gas-hallway": "+1-555-0102",
  "rent-balance": "+1-555-0112",
  "lease-break": "+1-555-0108",
  "noise-neighbor": "+1-555-0103",
  "ac-outage": "+1-555-0105",
};

function parsePropertyHint(hint: string): { propertyName: string; unitId: string } {
  const parts = hint.split(/[—–-]/).map((part) => part.trim()).filter(Boolean);
  const propertyName = parts[0] ?? hint.trim();
  const unitMatch = hint.match(/\b(?:unit|apartment|apt)\b\s*#?\s*([a-z0-9-]+)|#\s*([a-z0-9-]+)/i);
  const unitId = unitMatch?.[1] ?? unitMatch?.[2] ?? parts[1]?.replace(/^unit\s*/i, "") ?? "unknown";
  return { propertyName, unitId };
}

function propertySlugForName(propertyName: string): string {
  if (/^oak\s+ridge\s+apartments$/i.test(propertyName.trim())) {
    return "oakridge";
  }
  return slugifySegment(propertyName);
}

function issueSlugForScenario(scenario: PmCallScenario): string {
  if (scenario.id.includes("leak")) return "leak";
  if (scenario.id.includes("gas")) return "gas-odor";
  if (scenario.id.includes("rent") || scenario.id.includes("balance")) return "rent-balance";
  if (scenario.id.includes("lease")) return "lease-break";
  if (scenario.id.includes("noise")) return "noise-complaint";
  if (scenario.id.includes("ac")) return "ac-outage";
  return slugifySegment(scenario.title) || "general";
}

export function scenarioCaseContext(scenario: PmCallScenario): ScenarioCaseContext {
  const { propertyName, unitId } = parsePropertyHint(scenario.propertyHint);
  const issue = issueSlugForScenario(scenario);
  return {
    propertyId: propertySlugForName(propertyName),
    propertyName,
    unitId: slugifySegment(unitId),
    residentName: scenario.residentName,
    residentPhone: SCENARIO_PHONES[scenario.id],
    category: scenario.category,
    issue,
    title: scenario.title,
  };
}

export function urgencyToSeverity(
  urgency: PmCallEpisodeDigest["routing"]["urgency"],
): "low" | "normal" | "urgent" | "emergency" {
  switch (urgency) {
    case "emergency":
      return "emergency";
    case "high":
      return "urgent";
    case "low":
      return "low";
    default:
      return "normal";
  }
}

export function buildLookupKey(ctx: ScenarioCaseContext): string {
  return [ctx.propertyId, ctx.unitId, ctx.category, ctx.issue].join("|");
}

export function buildLookupTags(
  ctx: ScenarioCaseContext,
  severity: string,
  stage: string,
): string[] {
  return [
    `property:${ctx.propertyId}`,
    `unit:${ctx.unitId}`,
    `resident:${slugifySegment(ctx.residentName)}`,
    `category:${ctx.category}`,
    `issue:${ctx.issue}`,
    `severity:${severity}`,
    `stage:${stage}`,
  ];
}
