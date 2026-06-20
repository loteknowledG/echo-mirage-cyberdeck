import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurPosture } from "@/lib/muthur/muthur-posture";

export type MuthurCommanderArchiveEvent =
  | "muthur_posture_changed"
  | "muthur_mission_created"
  | "muthur_commander_activated"
  | "muthur_commander_awaiting_mission"
  | "muthur_commander_stood_down";

export function formatMuthurCommanderArchiveLine(
  event: MuthurCommanderArchiveEvent,
  detail?: Record<string, string | undefined>,
): string {
  switch (event) {
    case "muthur_posture_changed": {
      const from = detail?.from?.toUpperCase() ?? "?";
      const to = detail?.to?.toUpperCase() ?? "?";
      return `[MUTHUR] muthur_posture_changed // ${from} → ${to}`;
    }
    case "muthur_mission_created":
      return `[MUTHUR] muthur_mission_created // ${detail?.title ?? "mission"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_commander_activated":
      return `[MUTHUR] muthur_commander_activated // posture: ${detail?.posture ?? "?"} // ${detail?.title ?? ""}`.trim();
    case "muthur_commander_awaiting_mission":
      return "[MUTHUR] muthur_commander_awaiting_mission // AWAITING_MISSION";
    case "muthur_commander_stood_down":
      return `[MUTHUR] muthur_commander_stood_down // ${detail?.to?.toUpperCase() ?? "posture change"}`;
    default: {
      const _exhaustive: never = event;
      return `[MUTHUR] ${_exhaustive}`;
    }
  }
}

export function formatMuthurPostureChangedLine(from: MuthurPosture, to: MuthurPosture): string {
  return formatMuthurCommanderArchiveLine("muthur_posture_changed", { from, to });
}

export function formatMuthurMissionCreatedLine(mission: MuthurMission): string {
  return formatMuthurCommanderArchiveLine("muthur_mission_created", {
    title: mission.title,
    missionId: mission.id,
  });
}

export function formatMuthurCommanderActivatedLine(args: {
  posture: MuthurCommanderPosture;
  title?: string;
}): string {
  return formatMuthurCommanderArchiveLine("muthur_commander_activated", {
    posture: args.posture,
    title: args.title,
  });
}
