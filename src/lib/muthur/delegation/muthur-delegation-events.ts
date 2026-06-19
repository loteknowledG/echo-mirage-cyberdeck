import type { MuthurDelegationAssignment } from "@/lib/muthur/delegation/muthur-delegation-types";
import { delegationSummaryLine } from "@/lib/muthur/delegation/muthur-delegation-store";

export type MuthurDelegationArchiveEvent =
  | "muthur_delegation_package_prepared"
  | "muthur_delegation_dispatched"
  | "muthur_delegation_result_recorded"
  | "muthur_delegation_cancelled";

export function formatMuthurDelegationArchiveLine(
  event: MuthurDelegationArchiveEvent,
  detail?: Record<string, string | undefined>,
): string {
  switch (event) {
    case "muthur_delegation_package_prepared":
      return `[MUTHUR] muthur_delegation_package_prepared // ${detail?.summary ?? "assignment"} // ${detail?.assignmentId ?? ""}`.trim();
    case "muthur_delegation_dispatched":
      return `[MUTHUR] muthur_delegation_dispatched // ${detail?.worker ?? "worker"} // ${detail?.assignmentId ?? ""}`.trim();
    case "muthur_delegation_result_recorded":
      return `[MUTHUR] muthur_delegation_result_recorded // ${detail?.outcome ?? "result"} // ${detail?.assignmentId ?? ""}`.trim();
    case "muthur_delegation_cancelled":
      return `[MUTHUR] muthur_delegation_cancelled // ${detail?.assignmentId ?? "assignment"}`;
    default: {
      const _exhaustive: never = event;
      return `[MUTHUR] ${_exhaustive}`;
    }
  }
}

export function formatDelegationPreparedLine(assignment: MuthurDelegationAssignment): string {
  return formatMuthurDelegationArchiveLine("muthur_delegation_package_prepared", {
    summary: delegationSummaryLine(assignment),
    assignmentId: assignment.id,
  });
}

export function formatDelegationDispatchedLine(assignment: MuthurDelegationAssignment): string {
  return formatMuthurDelegationArchiveLine("muthur_delegation_dispatched", {
    worker: assignment.package.workerLabel,
    assignmentId: assignment.id,
  });
}

export function formatDelegationResultLine(
  assignment: MuthurDelegationAssignment,
  success: boolean,
): string {
  return formatMuthurDelegationArchiveLine("muthur_delegation_result_recorded", {
    outcome: success ? "completed" : "failed",
    assignmentId: assignment.id,
  });
}

export function formatDelegationCancelledLine(assignment: MuthurDelegationAssignment): string {
  return formatMuthurDelegationArchiveLine("muthur_delegation_cancelled", {
    assignmentId: assignment.id,
  });
}
