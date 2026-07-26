import type {
  ExperienceCandidate,
  ExperienceLesson,
  ExperiencePromotionAuditEntry,
  ExperienceReviewAuditEntry,
  ExperienceTraceArtifactSummary,
  ExperienceTraceRef,
} from "./experience-types";

export type ExperienceCandidateLineage = {
  candidate: ExperienceCandidate;
  trace: ExperienceTraceArtifactSummary;
  lesson: ExperienceLesson | null;
  reviewEvents: ExperienceReviewAuditEntry[];
  promotionEvents: ExperiencePromotionAuditEntry[];
};

export type ExperienceLessonLineage = {
  lesson: ExperienceLesson;
  candidate: ExperienceCandidate;
  trace: ExperienceTraceArtifactSummary;
  reviewEvents: ExperienceReviewAuditEntry[];
  promotionEvents: ExperiencePromotionAuditEntry[];
};

export type ExperienceDomainEvent =
  | { kind: "review"; entry: ExperienceReviewAuditEntry }
  | { kind: "promotion"; entry: ExperiencePromotionAuditEntry };

export function sortExperienceDomainEvents(
  events: ExperienceDomainEvent[],
): ExperienceDomainEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = left.entry.createdAt;
    const rightTime = right.entry.createdAt;
    if (leftTime === rightTime) {
      return left.entry.id.localeCompare(right.entry.id);
    }
    return leftTime.localeCompare(rightTime);
  });
}

export function buildCandidateLineage(input: {
  candidate: ExperienceCandidate;
  trace: ExperienceTraceArtifactSummary;
  lesson: ExperienceLesson | null;
  reviewEvents: ExperienceReviewAuditEntry[];
  promotionEvents: ExperiencePromotionAuditEntry[];
}): ExperienceCandidateLineage {
  return {
    candidate: input.candidate,
    trace: input.trace,
    lesson: input.lesson,
    reviewEvents: [...input.reviewEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    promotionEvents: [...input.promotionEvents].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  };
}

export function buildLessonLineage(input: {
  lesson: ExperienceLesson;
  candidate: ExperienceCandidate;
  trace: ExperienceTraceArtifactSummary;
  reviewEvents: ExperienceReviewAuditEntry[];
  promotionEvents: ExperiencePromotionAuditEntry[];
}): ExperienceLessonLineage {
  return {
    lesson: input.lesson,
    candidate: input.candidate,
    trace: input.trace,
    reviewEvents: [...input.reviewEvents].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    promotionEvents: [...input.promotionEvents].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  };
}

export function enrichTraceArtifactSummary(
  summary: ExperienceTraceArtifactSummary,
  traceRef: ExperienceTraceRef,
): ExperienceTraceArtifactSummary {
  return {
    ...summary,
    sessionId: summary.sessionId ?? traceRef.sessionId,
    runId: summary.runId ?? traceRef.runId,
    ingestedAt: traceRef.ingestedAt,
  };
}

export function mergeExperienceDomainEvents(input: {
  reviewEvents: ExperienceReviewAuditEntry[];
  promotionEvents: ExperiencePromotionAuditEntry[];
  candidateId?: string;
}): ExperienceDomainEvent[] {
  const reviewEvents = input.candidateId
    ? input.reviewEvents.filter((entry) => entry.candidateId === input.candidateId)
    : input.reviewEvents;
  const promotionEvents = input.candidateId
    ? input.promotionEvents.filter((entry) => entry.candidateId === input.candidateId)
    : input.promotionEvents;

  return sortExperienceDomainEvents([
    ...reviewEvents.map((entry) => ({ kind: "review" as const, entry })),
    ...promotionEvents.map((entry) => ({ kind: "promotion" as const, entry })),
  ]);
}
