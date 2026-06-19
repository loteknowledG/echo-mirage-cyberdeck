export const MUTHUR_DELEGATION_STATUSES = [
  "draft",
  "dispatched",
  "awaiting_result",
  "completed",
  "failed",
  "cancelled",
] as const;

export type MuthurDelegationStatus = (typeof MUTHUR_DELEGATION_STATUSES)[number];

/** External AI worker — native tool surface, not hosted by Echo Mirage. */
export type MuthurDelegationWorkerId =
  | "cursor"
  | "codex"
  | "opencode"
  | "chatgpt"
  | "human"
  | "other";

export type MuthurDelegationPackage = {
  id: string;
  missionId: string;
  workerId: MuthurDelegationWorkerId;
  workerLabel: string;
  title: string;
  objective: string;
  context: string;
  acceptanceCriteria: string[];
  constraints: string[];
  createdAt: string;
  updatedAt: string;
};

export type MuthurDelegationAssignment = {
  id: string;
  missionId: string;
  package: MuthurDelegationPackage;
  status: MuthurDelegationStatus;
  dispatchedAt?: string;
  resultSummary?: string;
  resultReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function isOpenMuthurDelegation(
  assignment: MuthurDelegationAssignment,
): boolean {
  return (
    assignment.status === "draft" ||
    assignment.status === "dispatched" ||
    assignment.status === "awaiting_result"
  );
}

export function isAwaitingDelegationResult(
  assignment: MuthurDelegationAssignment,
): boolean {
  return assignment.status === "dispatched" || assignment.status === "awaiting_result";
}
