import type {
  ExperienceCandidate,
  ExperienceCandidateSnapshot,
  ExperienceIngestConflict,
  ExperienceIngestResult,
  ExperienceLesson,
  ExperienceOperationalMetrics,
  ExperiencePromotionAuditEntry,
  ExperiencePromotionResult,
  ExperienceReviewAuditEntry,
  ExperienceReviewResult,
} from "./experience-types";
import {
  buildCandidateLineage,
  buildLessonLineage,
  enrichTraceArtifactSummary,
  mergeExperienceDomainEvents,
  type ExperienceCandidateLineage,
  type ExperienceDomainEvent,
  type ExperienceLessonLineage,
} from "./experience-lineage";
import { CalyxExperienceRepositoryUnavailableError } from "./experience-calyx-repository.server";
import { getExperienceRepository } from "./experience-repository-factory.server";
import {
  ExperienceConflictError,
  ExperienceNotFoundError,
  ExperienceTraceArtifactMutationError,
} from "./experience-repository";
import { ExperienceInvalidReviewTransitionError } from "./experience-review";
import { ExperiencePromotionNotAllowedError } from "./experience-promotion";
import {
  ExperienceTraceVerificationError,
  resolveExperienceIngestHmacSecret,
  verifySynapseTraceEnvelope,
} from "./experience-trace.server";
import {
  validatePromoteCandidateInput,
  validateReviewCandidateInput,
  type ValidationResult,
} from "./experience-validation";
import { resolveExperienceOwnerId } from "./experience-owner.server";

export class ExperienceValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(details.join("; "));
    this.name = "ExperienceValidationError";
  }
}

export class ExperienceIngestUnavailableError extends Error {
  constructor(message = "Experience ingest HMAC secret is not configured") {
    super(message);
    this.name = "ExperienceIngestUnavailableError";
  }
}

function assertValidation<T>(
  result: ValidationResult<T>,
): T {
  if (!result.ok) {
    throw new ExperienceValidationError(result.errors);
  }
  return result.value;
}

export async function ingestExperienceTrace(
  ownerId: string,
  envelopeInput: unknown,
): Promise<ExperienceIngestResult> {
  const secret = resolveExperienceIngestHmacSecret();
  if (!secret) {
    throw new ExperienceIngestUnavailableError();
  }

  const envelope = verifySynapseTraceEnvelope(envelopeInput, secret);
  return getExperienceRepository().ingestTraceCandidate(ownerId, envelope);
}

export async function reviewExperienceCandidate(
  ownerId: string,
  candidateId: string,
  input: unknown,
): Promise<ExperienceReviewResult> {
  const value = assertValidation(validateReviewCandidateInput(input));
  const actor = resolveExperienceOwnerId();
  return getExperienceRepository().reviewCandidate(
    ownerId,
    candidateId,
    value.action,
    actor,
    value.reason,
    value.reviewCommandId,
  );
}

export async function promoteExperienceCandidate(
  ownerId: string,
  candidateId: string,
  input: unknown,
): Promise<ExperiencePromotionResult> {
  const value = assertValidation(validatePromoteCandidateInput(input));
  const actor = resolveExperienceOwnerId();
  return getExperienceRepository().promoteCandidate(
    ownerId,
    candidateId,
    actor,
    value.reason,
    value.lesson,
    value.promotionCommandId,
  );
}

export async function listExperienceCandidates(
  ownerId: string,
  status?: string,
): Promise<ExperienceCandidate[]> {
  return getExperienceRepository().listCandidates(ownerId, status);
}

export async function listExperienceIngestConflicts(
  ownerId: string,
): Promise<ExperienceIngestConflict[]> {
  return getExperienceRepository().listIngestConflicts(ownerId);
}

export async function listExperienceReviewAudit(
  ownerId: string,
  candidateId?: string,
): Promise<ExperienceReviewAuditEntry[]> {
  return getExperienceRepository().listReviewAudit(ownerId, candidateId);
}

export async function listExperienceLessons(ownerId: string): Promise<ExperienceLesson[]> {
  return getExperienceRepository().listLessons(ownerId);
}

export async function listExperiencePromotionAudit(
  ownerId: string,
  candidateId?: string,
): Promise<ExperiencePromotionAuditEntry[]> {
  return getExperienceRepository().listPromotionAudit(ownerId, candidateId);
}

export async function getExperienceCandidateSnapshot(
  ownerId: string,
): Promise<ExperienceCandidateSnapshot> {
  return getExperienceRepository().getCandidateSnapshot(ownerId);
}

export async function getExperienceCandidate(
  ownerId: string,
  candidateId: string,
): Promise<ExperienceCandidate> {
  return getExperienceRepository().getCandidate(ownerId, candidateId);
}

export async function getExperienceLesson(
  ownerId: string,
  lessonId: string,
): Promise<ExperienceLesson> {
  return getExperienceRepository().getLesson(ownerId, lessonId);
}

export async function getExperienceOperationalMetrics(
  ownerId: string,
): Promise<ExperienceOperationalMetrics> {
  return getExperienceRepository().getOperationalMetrics(ownerId);
}

async function loadCandidateLineageParts(ownerId: string, candidateId: string) {
  const repo = getExperienceRepository();
  const candidate = await repo.getCandidate(ownerId, candidateId);
  const [traceSummary, reviewEvents, promotionEvents, lessons] = await Promise.all([
    repo.getTraceArtifactSummary(ownerId, candidate.traceRef.traceId),
    repo.listReviewAudit(ownerId, candidateId),
    repo.listPromotionAudit(ownerId, candidateId),
    repo.listLessons(ownerId),
  ]);
  const lesson = lessons.find((record) => record.candidateId === candidateId) ?? null;
  const trace = enrichTraceArtifactSummary(traceSummary, candidate.traceRef);
  return { candidate, trace, lesson, reviewEvents, promotionEvents };
}

export async function getExperienceCandidateLineage(
  ownerId: string,
  candidateId: string,
): Promise<ExperienceCandidateLineage> {
  const parts = await loadCandidateLineageParts(ownerId, candidateId);
  return buildCandidateLineage(parts);
}

export async function getExperienceLessonLineage(
  ownerId: string,
  lessonId: string,
): Promise<ExperienceLessonLineage> {
  const repo = getExperienceRepository();
  const lesson = await repo.getLesson(ownerId, lessonId);
  const parts = await loadCandidateLineageParts(ownerId, lesson.candidateId);
  if (parts.lesson && parts.lesson.id !== lessonId) {
    throw new ExperienceNotFoundError("Experience lesson lineage is inconsistent");
  }
  return buildLessonLineage({
    lesson: parts.lesson ?? lesson,
    candidate: parts.candidate,
    trace: parts.trace,
    reviewEvents: parts.reviewEvents,
    promotionEvents: parts.promotionEvents,
  });
}

export async function listExperienceDomainEvents(
  ownerId: string,
  candidateId?: string,
): Promise<ExperienceDomainEvent[]> {
  const repo = getExperienceRepository();
  const [reviewEvents, promotionEvents] = await Promise.all([
    repo.listReviewAudit(ownerId, candidateId),
    repo.listPromotionAudit(ownerId, candidateId),
  ]);
  return mergeExperienceDomainEvents({ reviewEvents, promotionEvents, candidateId });
}

export function mapExperienceServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
  details?: string[];
  conflictId?: string;
} {
  if (error instanceof ExperienceValidationError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.details,
    };
  }
  if (error instanceof ExperienceTraceVerificationError) {
    return {
      status: 400,
      code: "TRACE_VERIFICATION_FAILED",
      message: error.message,
    };
  }
  if (error instanceof ExperienceIngestUnavailableError) {
    return {
      status: 503,
      code: "INGEST_UNAVAILABLE",
      message: error.message,
    };
  }
  if (error instanceof ExperienceNotFoundError) {
    return { status: 404, code: "NOT_FOUND", message: error.message };
  }
  if (error instanceof ExperienceInvalidReviewTransitionError) {
    return {
      status: 409,
      code: "INVALID_REVIEW_TRANSITION",
      message: error.message,
    };
  }
  if (error instanceof ExperiencePromotionNotAllowedError) {
    return {
      status: 409,
      code: "PROMOTION_NOT_ALLOWED",
      message: error.message,
    };
  }
  if (error instanceof ExperienceTraceArtifactMutationError) {
    return {
      status: 409,
      code: "TRACE_ARTIFACT_MUTATION",
      message: error.message,
    };
  }
  if (error instanceof ExperienceConflictError) {
    return {
      status: 409,
      code: "CONFLICT",
      message: error.message,
      conflictId: error.conflictId,
    };
  }
  if (error instanceof CalyxExperienceRepositoryUnavailableError) {
    return { status: 503, code: "REPOSITORY_UNAVAILABLE", message: error.message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Unexpected server error" };
}

export {
  ExperienceConflictError,
  ExperienceNotFoundError,
  ExperienceTraceArtifactMutationError,
  ExperienceTraceVerificationError,
  ExperienceInvalidReviewTransitionError,
  ExperiencePromotionNotAllowedError,
  CalyxExperienceRepositoryUnavailableError,
};
