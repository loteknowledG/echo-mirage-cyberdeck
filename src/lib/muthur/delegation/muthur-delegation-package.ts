import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type {
  MuthurDelegationAssignment,
  MuthurDelegationPackage,
} from "@/lib/muthur/delegation/muthur-delegation-types";

const DEFAULT_CONSTRAINTS = [
  "MUTHUR retains mission authority.",
  "Use the worker's native tools only — Echo Mirage does not host this runtime.",
  "Return a concise summary with evidence when complete.",
];

export function defaultDelegationConstraints(): string[] {
  return [...DEFAULT_CONSTRAINTS];
}

export function formatMuthurDelegationPackageMessage(args: {
  mission: MuthurMission;
  assignment: MuthurDelegationAssignment;
}): string {
  const pkg = args.assignment.package;
  const criteria =
    pkg.acceptanceCriteria.length > 0
      ? pkg.acceptanceCriteria.map((item) => `- ${item}`).join("\n")
      : "- (none specified)";
  const constraints =
    pkg.constraints.length > 0
      ? pkg.constraints.map((item) => `- ${item}`).join("\n")
      : "- (none specified)";

  return [
    "# MUTHUR Delegation Package",
    "",
    `**Mission:** ${args.mission.title}`,
    `**Mission ID:** ${args.mission.id}`,
    `**Mission Objective:** ${args.mission.objective}`,
    "",
    "## Assignment",
    `**Worker:** ${pkg.workerLabel}`,
    `**Assignment ID:** ${args.assignment.id}`,
    `**Package ID:** ${pkg.id}`,
    `**Task:** ${pkg.title}`,
    "",
    "### Objective",
    pkg.objective,
    "",
    "### Context",
    pkg.context.trim() || "(none provided)",
    "",
    "### Acceptance Criteria",
    criteria,
    "",
    "### Constraints",
    constraints,
    "",
    "## Response Format",
    "When complete, return:",
    "1. Summary of work performed",
    "2. Files changed or artifacts produced",
    "3. Verification steps run",
    "4. Blockers or follow-ups for MUTHUR",
    "",
    `---`,
    `Prepared by MUTHUR COMMANDER // ${pkg.updatedAt}`,
  ].join("\n");
}

export function summarizeDelegationPackage(pkg: MuthurDelegationPackage): string {
  return `${pkg.workerLabel}: ${pkg.title}`;
}
