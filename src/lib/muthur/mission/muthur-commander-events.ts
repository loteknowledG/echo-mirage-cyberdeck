import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";
import type { MuthurUplinkMode } from "@/lib/muthur-uplink-mode";

export type MuthurCommanderArchiveEvent =
  | "muthur_mode_changed"
  | "muthur_mission_created"
  | "muthur_commander_activated"
  | "muthur_commander_awaiting_mission"
  | "muthur_commander_stood_down";

export function formatMuthurCommanderArchiveLine(
  event: MuthurCommanderArchiveEvent,
  detail?: Record<string, string | undefined>,
): string {
  switch (event) {
    case "muthur_mode_changed": {
      const from = detail?.from?.toUpperCase() ?? "?";
      const to = detail?.to?.toUpperCase() ?? "?";
      return `[MUTHUR] muthur_mode_changed // ${from} → ${to}`;
    }
    case "muthur_mission_created":
      return `[MUTHUR] muthur_mission_created // ${detail?.title ?? "mission"} // ${detail?.missionId ?? ""}`.trim();
    case "muthur_commander_activated":
      return `[MUTHUR] muthur_commander_activated // posture: ${detail?.posture ?? "?"} // ${detail?.title ?? ""}`.trim();
    case "muthur_commander_awaiting_mission":
      return "[MUTHUR] muthur_commander_awaiting_mission // AWAITING_MISSION";
    case "muthur_commander_stood_down":
      return `[MUTHUR] muthur_commander_stood_down // ${detail?.to?.toUpperCase() ?? "mode change"}`;
    default: {
      const _exhaustive: never = event;
      return `[MUTHUR] ${_exhaustive}`;
    }
  }
}

export function formatMuthurModeChangedLine(from: MuthurUplinkMode, to: MuthurUplinkMode): string {
  return formatMuthurCommanderArchiveLine("muthur_mode_changed", { from, to });
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
