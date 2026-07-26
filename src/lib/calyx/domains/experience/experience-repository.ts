import type {
  ExperienceCandidate,
  ExperienceCandidateSnapshot,
  ExperienceIngestConflict,
  ExperienceIngestResult,
  ExperienceLesson,
  ExperiencePromotionAuditEntry,
  ExperiencePromotionResult,
  ExperienceReviewAction,
  ExperienceReviewAuditEntry,
  ExperienceReviewResult,
} from "./experience-types";
import type { SynapseTraceEnvelopeV1 } from "./experience-trace.server";

export class ExperienceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceNotFoundError";
  }
}

export class ExperienceConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictId?: string,
  ) {
    super(message);
    this.name = "ExperienceConflictError";
  }
}

export class ExperienceTraceArtifactMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceTraceArtifactMutationError";
  }
}

export interface ExperienceRepository {
  ingestTraceCandidate(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<ExperienceIngestResult>;
  reviewCandidate(
    ownerId: string,
    candidateId: string,
    action: ExperienceReviewAction,
    actor: string,
    reason: string,
    reviewCommandId?: string,
  ): Promise<ExperienceReviewResult>;
  listCandidates(ownerId: string, status?: string): Promise<ExperienceCandidate[]>;
  listIngestConflicts(ownerId: string): Promise<ExperienceIngestConflict[]>;
  listReviewAudit(ownerId: string, candidateId?: string): Promise<ExperienceReviewAuditEntry[]>;
  promoteCandidate(
    ownerId: string,
    candidateId: string,
    actor: string,
    reason: string,
    lessonText?: string,
    promotionCommandId?: string,
  ): Promise<ExperiencePromotionResult>;
  listLessons(ownerId: string): Promise<ExperienceLesson[]>;
  listPromotionAudit(
    ownerId: string,
    candidateId?: string,
  ): Promise<ExperiencePromotionAuditEntry[]>;
  getCandidateSnapshot(ownerId: string): Promise<ExperienceCandidateSnapshot>;
}
