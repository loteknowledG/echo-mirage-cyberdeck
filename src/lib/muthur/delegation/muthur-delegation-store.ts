"use client";

import {
  defaultDelegationConstraints,
  summarizeDelegationPackage,
} from "@/lib/muthur/delegation/muthur-delegation-package";
import type {
  MuthurDelegationAssignment,
  MuthurDelegationPackage,
  MuthurDelegationStatus,
  MuthurDelegationWorkerId,
} from "@/lib/muthur/delegation/muthur-delegation-types";
import { getMuthurDelegationWorker } from "@/lib/muthur/delegation/muthur-workers";
import type { MuthurMission } from "@/lib/muthur/mission/muthur-mission-types";

export const MUTHUR_DELEGATION_STORAGE_KEY = "echo-mirage-muthur-delegations-v1";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function normalizePackage(raw: unknown): MuthurDelegationPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurDelegationPackage>;
  const workerId = item.workerId;
  if (
    workerId !== "cursor" &&
    workerId !== "codex" &&
    workerId !== "opencode" &&
    workerId !== "chatgpt" &&
    workerId !== "human" &&
    workerId !== "other"
  ) {
    return null;
  }
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.missionId !== "string" || !item.missionId.trim()) return null;
  if (typeof item.workerLabel !== "string" || !item.workerLabel.trim()) return null;
  if (typeof item.title !== "string" || !item.title.trim()) return null;
  if (typeof item.objective !== "string" || !item.objective.trim()) return null;
  if (typeof item.context !== "string") return null;
  if (!Array.isArray(item.acceptanceCriteria)) return null;
  if (!Array.isArray(item.constraints)) return null;
  if (typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") return null;

  return {
    id: item.id.trim(),
    missionId: item.missionId.trim(),
    workerId,
    workerLabel: item.workerLabel.trim(),
    title: item.title.trim(),
    objective: item.objective.trim(),
    context: item.context,
    acceptanceCriteria: item.acceptanceCriteria
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim()),
    constraints: item.constraints
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim()),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function normalizeAssignment(raw: unknown): MuthurDelegationAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<MuthurDelegationAssignment>;
  const status = item.status;
  if (
    status !== "draft" &&
    status !== "dispatched" &&
    status !== "awaiting_result" &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "cancelled"
  ) {
    return null;
  }
  const pkg = normalizePackage(item.package);
  if (!pkg) return null;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.missionId !== "string" || !item.missionId.trim()) return null;
  if (typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") return null;

  return {
    id: item.id.trim(),
    missionId: item.missionId.trim(),
    package: pkg,
    status,
    dispatchedAt: typeof item.dispatchedAt === "string" ? item.dispatchedAt : undefined,
    resultSummary: typeof item.resultSummary === "string" ? item.resultSummary : undefined,
    resultReceivedAt: typeof item.resultReceivedAt === "string" ? item.resultReceivedAt : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function loadMuthurDelegations(): MuthurDelegationAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(MUTHUR_DELEGATION_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeAssignment(entry))
      .filter((entry): entry is MuthurDelegationAssignment => Boolean(entry));
  } catch {
    return [];
  }
}

export function saveMuthurDelegations(assignments: MuthurDelegationAssignment[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_DELEGATION_STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    /* ignore */
  }
}

export function listDelegationsForMission(
  assignments: MuthurDelegationAssignment[],
  missionId: string,
): MuthurDelegationAssignment[] {
  return assignments
    .filter((entry) => entry.missionId === missionId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createMuthurDelegation(input: {
  mission: MuthurMission;
  workerId: MuthurDelegationWorkerId;
  title: string;
  objective: string;
  context?: string;
  acceptanceCriteria?: string[];
  constraints?: string[];
}): MuthurDelegationAssignment {
  const stamp = nowIso();
  const worker = getMuthurDelegationWorker(input.workerId);
  const pkg: MuthurDelegationPackage = {
    id: newId("pkg"),
    missionId: input.mission.id,
    workerId: input.workerId,
    workerLabel: worker.label,
    title: input.title.trim(),
    objective: input.objective.trim(),
    context: (input.context ?? input.mission.objective).trim(),
    acceptanceCriteria: input.acceptanceCriteria ?? [],
    constraints: input.constraints ?? defaultDelegationConstraints(),
    createdAt: stamp,
    updatedAt: stamp,
  };

  return {
    id: newId("asg"),
    missionId: input.mission.id,
    package: pkg,
    status: "draft",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function markDelegationDispatched(
  assignment: MuthurDelegationAssignment,
): MuthurDelegationAssignment {
  const stamp = nowIso();
  return {
    ...assignment,
    status: "awaiting_result",
    dispatchedAt: stamp,
    updatedAt: stamp,
    package: { ...assignment.package, updatedAt: stamp },
  };
}

export function recordDelegationResult(
  assignment: MuthurDelegationAssignment,
  input: { success: boolean; summary: string },
): MuthurDelegationAssignment {
  const stamp = nowIso();
  return {
    ...assignment,
    status: input.success ? "completed" : "failed",
    resultSummary: input.summary.trim(),
    resultReceivedAt: stamp,
    updatedAt: stamp,
    package: { ...assignment.package, updatedAt: stamp },
  };
}

export function cancelMuthurDelegation(
  assignment: MuthurDelegationAssignment,
): MuthurDelegationAssignment {
  const stamp = nowIso();
  return {
    ...assignment,
    status: "cancelled",
    updatedAt: stamp,
    package: { ...assignment.package, updatedAt: stamp },
  };
}

export function replaceDelegation(
  assignments: MuthurDelegationAssignment[],
  next: MuthurDelegationAssignment,
): MuthurDelegationAssignment[] {
  const index = assignments.findIndex((entry) => entry.id === next.id);
  if (index < 0) return [next, ...assignments];
  const copy = [...assignments];
  copy[index] = next;
  return copy;
}

export function delegationSummaryLine(assignment: MuthurDelegationAssignment): string {
  return summarizeDelegationPackage(assignment.package);
}

export function parseAcceptanceCriteriaInput(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatDelegationStatusLabel(status: MuthurDelegationStatus): string {
  return status.replace(/_/g, " ").toUpperCase();
}
