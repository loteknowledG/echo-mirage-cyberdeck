import type { PmCallEpisodeDigest } from "@/lib/pm-call-center/types";
import type { PropertyCase } from "@/lib/property-manager/cases/types";
import { urgencyToSeverity } from "@/lib/property-manager/cases/scenario-context";

export function buildCallSummaryMarkdown(digest: PmCallEpisodeDigest): string {
  const severity = urgencyToSeverity(digest.routing.urgency);
  const bullets: string[] = [digest.residentIntent.trim()];

  if (digest.operatorActions.length > 0) {
    bullets.push(...digest.operatorActions.map((action) => action.trim()).filter(Boolean));
  }

  if (digest.outcome.trim()) {
    bullets.push(digest.outcome.trim());
  }

  const uniqueBullets = [...new Set(bullets)].filter(Boolean);

  const lines = [
    "# Call Summary",
    "",
    ...uniqueBullets.map((line) => line.endsWith(".") ? line : `${line}.`),
    "",
    `Severity: ${severity.charAt(0).toUpperCase()}${severity.slice(1)}`,
    "",
  ];

  return lines.join("\n");
}

export function buildCaseSummaryMarkdown(caseRecord: PropertyCase): string {
  const lines = [
    "# Case Summary",
    "",
    caseRecord.title,
    "",
    `Property: ${caseRecord.propertyName} // Unit ${caseRecord.unitId}`,
    `Category: ${caseRecord.category}`,
    `Issue: ${caseRecord.issue}`,
    `Severity: ${caseRecord.severity}`,
    `Stage: ${caseRecord.stage}`,
    `Status: ${caseRecord.status}`,
    "",
    `Calls on record: ${caseRecord.callIds.length}`,
    "",
  ];

  if (caseRecord.residentName) {
    lines.push(`Resident: ${caseRecord.residentName}`);
  }
  if (caseRecord.residentPhone) {
    lines.push(`Phone: ${caseRecord.residentPhone}`);
  }

  lines.push("");
  return lines.join("\n");
}
