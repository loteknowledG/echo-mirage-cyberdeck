import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MuthurUplinkMode } from "@/lib/muthur-uplink-mode";

export type MuthurCommanderPosture =
  | "AWAITING_MISSION"
  | "PREPARING"
  | "EXECUTING"
  | "WAITING"
  | "VERIFYING";

export function getMuthurCommanderPosture(
  mode: MuthurUplinkMode,
  mission: MuthurMission | null | undefined,
): MuthurCommanderPosture | null {
  if (mode !== "commander") return null;
  if (!mission) return "AWAITING_MISSION";

  switch (mission.status) {
    case "draft":
    case "ready":
      return "PREPARING";
    case "active":
      return "EXECUTING";
    case "blocked":
      return "WAITING";
    case "verifying":
      return "VERIFYING";
    case "completed":
    case "aborted":
      return "AWAITING_MISSION";
    default: {
      const _exhaustive: never = mission.status;
      return _exhaustive;
    }
  }
}

export function formatMuthurCommanderPostureLabel(
  posture: MuthurCommanderPosture | null,
): string {
  return posture ?? "—";
}
