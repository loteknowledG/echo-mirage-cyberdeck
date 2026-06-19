import {
  formatMuthurMissionLifecycleLine,
  lifecycleEventForStatus,
} from "@/lib/muthur/mission/muthur-mission-events";
import { saveMuthurMission } from "@/lib/muthur/mission/muthur-mission-store";
import type { MuthurMission, MuthurMissionStatus } from "@/lib/muthur/mission/muthur-mission-types";

export type MissionLifecycleResult = {
  ok: boolean;
  mission: MuthurMission;
  archiveLine: string;
  fromStatus: MuthurMissionStatus;
  toStatus: MuthurMissionStatus;
};

const ALLOWED_TRANSITIONS: Record<MuthurMissionStatus, ReadonlySet<MuthurMissionStatus>> = {
  draft: new Set(["ready", "aborted"]),
  ready: new Set(["active", "aborted"]),
  active: new Set(["blocked", "verifying", "completed", "aborted"]),
  blocked: new Set(["active", "verifying", "aborted"]),
  verifying: new Set(["completed", "blocked", "aborted"]),
  completed: new Set(),
  aborted: new Set(),
};

function nowIso(): string {
  return new Date().toISOString();
}

export function canTransitionMissionStatus(
  from: MuthurMissionStatus,
  to: MuthurMissionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].has(to);
}

function rejectTransition(
  mission: MuthurMission,
  to: MuthurMissionStatus,
  reason: string,
): MissionLifecycleResult {
  return {
    ok: false,
    mission,
    fromStatus: mission.status,
    toStatus: to,
    archiveLine: formatMuthurMissionLifecycleLine("muthur_mission_transition_rejected", {
      from: mission.status,
      to,
      reason,
      missionId: mission.id,
    }),
  };
}

function commitTransition(
  mission: MuthurMission,
  to: MuthurMissionStatus,
  patch: Partial<MuthurMission> = {},
): MissionLifecycleResult {
  if (!canTransitionMissionStatus(mission.status, to)) {
    return rejectTransition(mission, to, "transition not allowed");
  }

  const stamp = nowIso();
  const next: MuthurMission = {
    ...mission,
    ...patch,
    status: to,
    updatedAt: stamp,
  };

  saveMuthurMission(next);

  const event = lifecycleEventForStatus(to);
  const archiveLine = formatMuthurMissionLifecycleLine(event, {
    title: next.title,
    missionId: next.id,
    reason: next.blockedReason ?? next.abortReason,
  });

  return {
    ok: true,
    mission: next,
    archiveLine,
    fromStatus: mission.status,
    toStatus: to,
  };
}

export function setMissionDraft(mission: MuthurMission): MissionLifecycleResult {
  if (mission.status === "draft") {
    const line = formatMuthurMissionLifecycleLine("muthur_mission_draft", {
      title: mission.title,
      missionId: mission.id,
    });
    saveMuthurMission(mission);
    return {
      ok: true,
      mission,
      archiveLine: line,
      fromStatus: "draft",
      toStatus: "draft",
    };
  }
  return rejectTransition(mission, "draft", "mission is not draftable from current state");
}

export function setMissionReady(mission: MuthurMission): MissionLifecycleResult {
  return commitTransition(mission, "ready");
}

export function activateMission(mission: MuthurMission): MissionLifecycleResult {
  const stamp = nowIso();
  return commitTransition(mission, "active", {
    startedAt: mission.startedAt ?? stamp,
    blockedReason: undefined,
    blockedAt: undefined,
  });
}

export function blockMission(mission: MuthurMission, reason: string): MissionLifecycleResult {
  const trimmed = reason.trim();
  if (!trimmed) {
    return rejectTransition(mission, "blocked", "blocked reason required");
  }
  return commitTransition(mission, "blocked", {
    blockedReason: trimmed,
    blockedAt: nowIso(),
  });
}

export function setMissionVerifying(mission: MuthurMission): MissionLifecycleResult {
  return commitTransition(mission, "verifying", {
    verifyingAt: mission.verifyingAt ?? nowIso(),
    blockedReason: undefined,
    blockedAt: undefined,
  });
}

export function completeMission(mission: MuthurMission): MissionLifecycleResult {
  return commitTransition(mission, "completed", {
    completedAt: nowIso(),
    blockedReason: undefined,
    blockedAt: undefined,
  });
}

export function abortMission(mission: MuthurMission, reason: string): MissionLifecycleResult {
  const trimmed = reason.trim();
  if (!trimmed) {
    return rejectTransition(mission, "aborted", "abort reason required");
  }
  return commitTransition(mission, "aborted", {
    abortReason: trimmed,
    abortedAt: nowIso(),
  });
}
