import type {
  ExperienceCandidateStatus,
  ExperienceReviewAction,
} from "./experience-types";

export type { ExperienceReviewAction };

export class ExperienceInvalidReviewTransitionError extends Error {
  constructor(
    message: string,
    public readonly fromStatus: ExperienceCandidateStatus,
    public readonly action: ExperienceReviewAction,
  ) {
    super(message);
    this.name = "ExperienceInvalidReviewTransitionError";
  }
}

const REVIEW_TARGET_STATUS: Record<ExperienceReviewAction, ExperienceCandidateStatus> = {
  reject: "REJECTED",
  dispute: "DISPUTED",
  archive: "ARCHIVED",
};

const ALLOWED_REVIEW_TRANSITIONS: Record<
  ExperienceCandidateStatus,
  ExperienceCandidateStatus[]
> = {
  DRAFT: ["REJECTED", "DISPUTED", "ARCHIVED"],
  DISPUTED: ["REJECTED", "ARCHIVED"],
  REJECTED: [],
  ARCHIVED: [],
  VERIFIED: [],
};

export function resolveReviewTargetStatus(
  action: ExperienceReviewAction,
): ExperienceCandidateStatus {
  return REVIEW_TARGET_STATUS[action];
}

export function assertReviewTransitionAllowed(
  fromStatus: ExperienceCandidateStatus,
  action: ExperienceReviewAction,
): ExperienceCandidateStatus {
  const targetStatus = resolveReviewTargetStatus(action);
  const allowed = ALLOWED_REVIEW_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new ExperienceInvalidReviewTransitionError(
      `Review transition ${fromStatus} -> ${targetStatus} is not allowed`,
      fromStatus,
      action,
    );
  }
  return targetStatus;
}

export function isReviewTransitionAllowed(
  fromStatus: ExperienceCandidateStatus,
  action: ExperienceReviewAction,
): boolean {
  try {
    assertReviewTransitionAllowed(fromStatus, action);
    return true;
  } catch (error) {
    if (error instanceof ExperienceInvalidReviewTransitionError) {
      return false;
    }
    throw error;
  }
}
