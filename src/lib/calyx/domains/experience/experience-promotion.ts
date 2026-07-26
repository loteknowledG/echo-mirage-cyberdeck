import type { ExperienceCandidateStatus } from "./experience-types";

export class ExperiencePromotionNotAllowedError extends Error {
  constructor(
    message: string,
    public readonly candidateStatus: ExperienceCandidateStatus,
  ) {
    super(message);
    this.name = "ExperiencePromotionNotAllowedError";
  }
}

const PROMOTION_ELIGIBLE_STATUSES = new Set<ExperienceCandidateStatus>(["DRAFT"]);

export function assertPromotionEligible(
  candidateStatus: ExperienceCandidateStatus,
): void {
  if (PROMOTION_ELIGIBLE_STATUSES.has(candidateStatus)) {
    return;
  }
  throw new ExperiencePromotionNotAllowedError(
    `Promotion is only allowed from DRAFT; candidate status is ${candidateStatus}`,
    candidateStatus,
  );
}

export function isPromotionEligible(candidateStatus: ExperienceCandidateStatus): boolean {
  return PROMOTION_ELIGIBLE_STATUSES.has(candidateStatus);
}
