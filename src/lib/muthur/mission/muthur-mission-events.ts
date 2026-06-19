import type { MuthurMission, MuthurMissionStatus } from "@/lib/muthur/mission/muthur-mission-types";

export type MuthurMissionLifecycleEvent =
  | "muthur_mission_draft"
  | "muthur_mission_ready"
  | "muthur_mission_activated"
  | "muthur_mission_blocked"
  | "muthur_mission_verifying"
  | "muthur_mission_completed"
  | "muthur_mission_aborted"
  | "muthur_mission_transition_rejected";

export function formatMuthurMissionLifecycleLine(
  event: MuthurMissionLifecycleEvent,
  detail?: Record<string, string | undefined>,
): string {
  switch (event) {
    case "muthur_mission_draft":
      return `[MUTHUR] muthur_mission_draft // ${detail?.title ?? "mission"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_mission_ready":
      return `[MUTHUR] muthur_mission_ready // ${detail?.title ?? "mission"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_mission_activated":
      return `[MUTHUR] muthur_mission_activated // ${detail?.title ?? "mission"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_mission_blocked":
      return `[MUTHUR] muthur_mission_blocked // ${detail?.reason ?? "blocked"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_mission_verifying":
      return `[MUTHUR] muthur_mission_verifying // ${detail?.missionId ?? "mission"}`;
    case "muthur_mission_completed":
      return `[MUTHUR] muthur_mission_completed // ${detail?.missionId ?? "mission"}`;
    case "muthur_mission_aborted":
      return `[MUTHUR] muthur_mission_aborted // ${detail?.reason ?? "aborted"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_mission_transition_rejected":
      return `[MUTHUR] muthur_mission_transition_rejected // ${detail?.from?.toUpperCase() ?? "?"} → ${detail?.to?.toUpperCase() ?? "?"} // ${detail?.reason ?? "invalid transition"}`.trim();
    default: {
      const _exhaustive: never = event;
      return `[MUTHUR] ${_exhaustive}`;
    }
  }
}

export function lifecycleEventForStatus(status: MuthurMissionStatus): MuthurMissionLifecycleEvent {
  switch (status) {
    case "draft":
      return "muthur_mission_draft";
    case "ready":
      return "muthur_mission_ready";
    case "active":
      return "muthur_mission_activated";
    case "blocked":
      return "muthur_mission_blocked";
    case "verifying":
      return "muthur_mission_verifying";
    case "completed":
      return "muthur_mission_completed";
    case "aborted":
      return "muthur_mission_aborted";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function formatMissionLifecycleLineForMission(
  mission: MuthurMission,
  event?: MuthurMissionLifecycleEvent,
): string {
  const resolved = event ?? lifecycleEventForStatus(mission.status);
  return formatMuthurMissionLifecycleLine(resolved, {
    title: mission.title,
    missionId: mission.id,
    reason: mission.blockedReason ?? mission.abortReason,
  });
}
