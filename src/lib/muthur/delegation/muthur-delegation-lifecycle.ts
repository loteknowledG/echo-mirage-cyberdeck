import {
  isAwaitingDelegationResult,
  type MuthurDelegationAssignment,
} from "@/lib/muthur/delegation/muthur-delegation-types";
import {
  activateMission,
  blockMission,
  setMissionReady,
  setMissionVerifying,
  type MissionLifecycleResult,
} from "@/lib/muthur/mission/muthur-mission-lifecycle";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";

const AWAITING_WORKER_REASON = "Awaiting worker result";
const WORKER_FAILURE_REASON = "Worker reported failure";

function hasAwaitingDelegations(assignments: MuthurDelegationAssignment[]): boolean {
  return assignments.some((entry) => isAwaitingDelegationResult(entry));
}

function hasFailedDelegations(assignments: MuthurDelegationAssignment[]): boolean {
  return assignments.some((entry) => entry.status === "failed");
}

function hasDraftDelegations(assignments: MuthurDelegationAssignment[]): boolean {
  return assignments.some((entry) => entry.status === "draft");
}

export function advanceMissionForDelegationDispatch(
  mission: MuthurMission,
  assignmentsForMission: MuthurDelegationAssignment[],
): MissionLifecycleResult | null {
  if (!hasAwaitingDelegations(assignmentsForMission)) return null;
  if (mission.status === "blocked" && mission.blockedReason === AWAITING_WORKER_REASON) {
    return null;
  }
  const result = blockMission(mission, AWAITING_WORKER_REASON);
  return result.ok ? result : null;
}

export function advanceMissionForDelegationResult(
  mission: MuthurMission,
  assignmentsForMission: MuthurDelegationAssignment[],
  success: boolean,
): MissionLifecycleResult | null {
  if (success) {
    if (mission.status === "verifying") return null;
    const result = setMissionVerifying(mission);
    return result.ok ? result : null;
  }

  if (!hasFailedDelegations(assignmentsForMission)) return null;
  if (mission.status === "blocked" && mission.blockedReason === WORKER_FAILURE_REASON) {
    return null;
  }
  const result = blockMission(mission, WORKER_FAILURE_REASON);
  return result.ok ? result : null;
}

export function advanceMissionWhenDelegationsClear(
  mission: MuthurMission,
  assignmentsForMission: MuthurDelegationAssignment[],
): MissionLifecycleResult | null {
  if (hasAwaitingDelegations(assignmentsForMission)) return null;
  if (mission.status !== "blocked") return null;
  if (hasFailedDelegations(assignmentsForMission)) return null;

  if (mission.startedAt || hasDraftDelegations(assignmentsForMission)) {
    const result = activateMission(mission);
    return result.ok ? result : null;
  }

  const result = setMissionReady(mission);
  return result.ok ? result : null;
}
