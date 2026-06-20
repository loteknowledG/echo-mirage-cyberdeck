import type { MuthurDelegationAssignment } from "@/lib/muthur/delegation/muthur-delegation-types";
import type { MuthurCognitionEmitInput } from "@/lib/muthur/cognition/muthur-cognition-types";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";
import type { MissionLifecycleResult } from "@/lib/muthur/mission/muthur-mission-lifecycle";
import type { MuthurCommanderPosture } from "@/lib/muthur/mission/muthur-commander-posture";

export function cognitionFromUserMessage(message: string): MuthurCognitionEmitInput {
  const snippet = message.trim().replace(/\s+/g, " ").slice(0, 140);
  return {
    category: "observe",
    message: snippet ? `Operator message topic: ${snippet}` : "Operator sent an empty message.",
    source: "chat",
  };
}

export function cognitionFromMemoryContext(
  memoryContext: string,
  query?: string,
): MuthurCognitionEmitInput | null {
  if (!memoryContext.includes("Relevant memory hits:")) return null;
  const topic = query?.trim().replace(/\s+/g, " ").slice(0, 80);
  return {
    category: "retrieve",
    message: topic
      ? `Memory retrieval found related context for "${topic}".`
      : "Memory retrieval found related prior context.",
    source: "memory",
  };
}

export function cognitionFromMissionLifecycle(
  result: MissionLifecycleResult,
  mission: MuthurMission,
): MuthurCognitionEmitInput {
  if (!result.ok) {
    return {
      category: "warning",
      message: `Mission transition rejected: ${mission.status} → ${result.toStatus}.`,
      missionId: mission.id,
      source: "mission-lifecycle",
    };
  }

  const label = result.toStatus.toUpperCase();
  let message = `Mission ${label.toLowerCase()}.`;
  if (result.toStatus === "blocked" && mission.blockedReason) {
    message = `Mission blocked: ${mission.blockedReason}`;
  } else if (result.toStatus === "active") {
    message = `Mission activated: ${mission.title}`;
  } else if (result.toStatus === "verifying") {
    message = `Mission verifying: ${mission.title}`;
  } else if (result.toStatus === "completed") {
    message = `Mission completed: ${mission.title}`;
  } else if (result.toStatus === "ready") {
    message = `Mission ready for execution: ${mission.title}`;
  }

  return {
    category: "mission",
    message,
    missionId: mission.id,
    source: "mission-lifecycle",
  };
}

export function cognitionFromMissionCreated(mission: MuthurMission): MuthurCognitionEmitInput {
  return {
    category: "mission",
    message: `Mission drafted: ${mission.title}`,
    missionId: mission.id,
    source: "mission",
  };
}

export function cognitionFromCommanderPosture(args: {
  posture: MuthurCommanderPosture;
  missionTitle?: string;
}): MuthurCognitionEmitInput {
  if (args.posture === "AWAITING_MISSION") {
    return {
      category: "observe",
      message: "Commander standing by — no mission assigned yet.",
      source: "commander",
    };
  }
  if (args.posture === "PREPARING") {
    return {
      category: "synthesize",
      message: args.missionTitle
        ? `Mission "${args.missionTitle}" is being prepared before execution.`
        : "Mission preparation in progress.",
      source: "commander",
    };
  }
  if (args.posture === "EXECUTING") {
    return {
      category: "mission",
      message: args.missionTitle
        ? `Mission "${args.missionTitle}" is executing.`
        : "Mission execution underway.",
      source: "commander",
    };
  }
  if (args.posture === "WAITING") {
    return {
      category: "reflect",
      message: "Mission waiting on external input or worker result.",
      source: "commander",
    };
  }
  return {
    category: "reflect",
    message: "Mission result awaiting verification.",
    source: "commander",
  };
}

export function cognitionFromDelegationPrepared(
  assignment: MuthurDelegationAssignment,
): MuthurCognitionEmitInput {
  return {
    category: "synthesize",
    message: `Prepared delegation package for ${assignment.package.workerLabel}: ${assignment.package.title}`,
    missionId: assignment.missionId,
    source: "delegation",
  };
}

export function cognitionFromDelegationDispatched(
  assignment: MuthurDelegationAssignment,
): MuthurCognitionEmitInput {
  return {
    category: "recommend",
    message: `Assignment dispatched to ${assignment.package.workerLabel}: ${assignment.package.title}`,
    missionId: assignment.missionId,
    source: "delegation",
  };
}

export function cognitionFromDelegationResult(
  assignment: MuthurDelegationAssignment,
  success: boolean,
): MuthurCognitionEmitInput {
  return {
    category: success ? "synthesize" : "warning",
    message: success
      ? `Worker ${assignment.package.workerLabel} reported success for ${assignment.package.title}.`
      : `Worker ${assignment.package.workerLabel} reported failure for ${assignment.package.title}.`,
    missionId: assignment.missionId,
    source: "delegation",
  };
}

export function cognitionFromDelegationCancelled(
  assignment: MuthurDelegationAssignment,
): MuthurCognitionEmitInput {
  return {
    category: "reflect",
    message: `Delegation cancelled: ${assignment.package.title}`,
    missionId: assignment.missionId,
    source: "delegation",
  };
}
