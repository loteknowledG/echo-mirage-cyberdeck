"use client";

import {
  type MuthurMission,
  type MuthurMissionStatus,
  canExecuteCommanderMissionWork,
  isActiveMuthurMission,
  normalizeLegacyMissionStatus,
} from "@/lib/muthur/mission/muthur-mission-types";

export const MUTHUR_MISSION_STORAGE_KEY = "echo-mirage-muthur-mission-v1";

function nowIso(): string {
  return new Date().toISOString();
}

function newMissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mission-${Date.now()}`;
}

function normalizeMission(raw: unknown): MuthurMission | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurMission>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.title !== "string" || !item.title.trim()) return null;
  if (typeof item.objective !== "string") return null;
  const status = normalizeLegacyMissionStatus(item.status);
  if (!status) return null;
  if (typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") return null;

  return {
    id: item.id.trim(),
    title: item.title.trim(),
    objective: item.objective.trim(),
    status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    startedAt: typeof item.startedAt === "string" ? item.startedAt : undefined,
    completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
    blockedAt: typeof item.blockedAt === "string" ? item.blockedAt : undefined,
    abortedAt: typeof item.abortedAt === "string" ? item.abortedAt : undefined,
    verifyingAt: typeof item.verifyingAt === "string" ? item.verifyingAt : undefined,
    blockedReason: typeof item.blockedReason === "string" ? item.blockedReason : undefined,
    abortReason: typeof item.abortReason === "string" ? item.abortReason : undefined,
  };
}

export function loadMuthurMission(): MuthurMission | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(MUTHUR_MISSION_STORAGE_KEY);
    if (!stored) return null;
    return normalizeMission(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveMuthurMission(mission: MuthurMission | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!mission) {
      window.localStorage.removeItem(MUTHUR_MISSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MUTHUR_MISSION_STORAGE_KEY, JSON.stringify(mission));
  } catch {
    /* ignore */
  }
}

export function getExecutableMuthurMission(): MuthurMission | null {
  const mission = loadMuthurMission();
  return canExecuteCommanderMissionWork(mission) ? mission : null;
}

/** @deprecated Use getExecutableMuthurMission — execution requires ACTIVE mission. */
export function getCommanderEligibleMission(): MuthurMission | null {
  return getExecutableMuthurMission();
}

/** @deprecated Use getExecutableMuthurMission. */
export function getActiveMuthurMission(): MuthurMission | null {
  const mission = loadMuthurMission();
  return isActiveMuthurMission(mission) ? mission : null;
}

export function createMuthurMission(input: {
  title: string;
  objective: string;
  status?: MuthurMissionStatus;
}): MuthurMission {
  const stamp = nowIso();
  return {
    id: newMissionId(),
    title: input.title.trim(),
    objective: input.objective.trim(),
    status: input.status ?? "draft",
    createdAt: stamp,
    updatedAt: stamp,
  };
}
