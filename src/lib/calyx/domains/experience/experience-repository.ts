import type {
  ExperienceCandidate,
  ExperienceCandidateSnapshot,
} from "./experience-types";
import type { SynapseTraceEnvelopeV1 } from "./experience-trace.server";

export class ExperienceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceNotFoundError";
  }
}

export class ExperienceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceConflictError";
  }
}

export interface ExperienceRepository {
  ingestTraceCandidate(
    ownerId: string,
    envelope: SynapseTraceEnvelopeV1,
  ): Promise<ExperienceCandidate>;
  listCandidates(ownerId: string, status?: string): Promise<ExperienceCandidate[]>;
  getCandidateSnapshot(ownerId: string): Promise<ExperienceCandidateSnapshot>;
}
