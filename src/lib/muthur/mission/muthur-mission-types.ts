export const MUTHUR_MISSION_STATUSES = [
  "draft",
  "ready",
  "active",
  "blocked",
  "verifying",
  "completed",
  "aborted",
] as const;

export type MuthurMissionStatus = (typeof MUTHUR_MISSION_STATUSES)[number];

export type MuthurMission = {
  id: string;
  title: string;
  objective: string;
  status: MuthurMissionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  blockedAt?: string;
  abortedAt?: string;
  verifyingAt?: string;
  blockedReason?: string;
  abortReason?: string;
};

const OPERATIONAL_STATUSES = new Set<MuthurMissionStatus>([
  "active",
  "blocked",
  "verifying",
]);

export function isActiveMuthurMission(
  mission: MuthurMission | null | undefined,
): mission is MuthurMission {
  return Boolean(mission && mission.status === "active");
}

/** Mission work (tools, delegation, execution) requires ACTIVE lifecycle state. */
export function canExecuteCommanderMissionWork(
  mission: MuthurMission | null | undefined,
): mission is MuthurMission {
  return isActiveMuthurMission(mission);
}

export function isOperationalMuthurMission(
  mission: MuthurMission | null | undefined,
): mission is MuthurMission {
  return Boolean(mission && OPERATIONAL_STATUSES.has(mission.status));
}

export function normalizeLegacyMissionStatus(status: unknown): MuthurMissionStatus | null {
  if (status === "idle") return "active";
  if (
    status === "draft" ||
    status === "ready" ||
    status === "active" ||
    status === "blocked" ||
    status === "verifying" ||
    status === "completed" ||
    status === "aborted"
  ) {
    return status;
  }
  return null;
}
