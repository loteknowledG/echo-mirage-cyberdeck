export type {
  ExperienceCandidate,
  ExperienceCandidateSnapshot,
  ExperienceCandidateStatus,
  ExperienceIngestConflict,
  ExperienceIngestReplayOutcome,
  ExperienceIngestResult,
  ExperienceLesson,
  ExperienceLessonApprovedBy,
  ExperienceLessonStatus,
  ExperienceOutcome,
  ExperiencePromotionAuditEntry,
  ExperiencePromotionOutcome,
  ExperiencePromotionResult,
  ExperienceOperationalMetrics,
  ExperienceReviewAction,
  ExperienceReviewAuditEntry,
  ExperienceReviewOutcome,
  ExperienceReviewResult,
  ExperienceStorageMode,
  ExperienceTraceRef,
  ExperienceTraceArtifactSummary,
} from "./experience-types";

export type { ApiResponse, ExperienceStatusPayload } from "./experience-api-types";

export type { ValidationResult } from "./experience-validation";

export {
  computeActionHash,
  computeExperienceCandidateId,
  deriveCandidateSummary,
} from "./experience-identity";

export {
  assertReviewTransitionAllowed,
  isReviewTransitionAllowed,
  resolveReviewTargetStatus,
} from "./experience-review";

export {
  assertPromotionEligible,
  isPromotionEligible,
} from "./experience-promotion";

export type {
  ExperienceCandidateLineage,
  ExperienceDomainEvent,
  ExperienceLessonLineage,
} from "./experience-lineage";

export {
  buildCandidateLineage,
  buildLessonLineage,
  enrichTraceArtifactSummary,
  mergeExperienceDomainEvents,
  sortExperienceDomainEvents,
} from "./experience-lineage";

export { digestTraceEnvelope, envelopesMateriallyEqual } from "./experience-content";

export type { ExperienceRepository } from "./experience-repository";

export { SYNAPSE_TRACE_ENVELOPE_CONTRACT } from "./experience-types";
