import type {
  ExperienceCandidate,
  ExperienceCandidateSnapshot,
  ExperienceIngestConflict,
  ExperienceIngestResult,
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
  listCandidates(ownerId: string, status?: string): Promise<ExperienceCandidate[]>;
  listIngestConflicts(ownerId: string): Promise<ExperienceIngestConflict[]>;
  getCandidateSnapshot(ownerId: string): Promise<ExperienceCandidateSnapshot>;
}
