import type { ExperienceCandidate, ExperienceCandidateSnapshot } from "./experience-types";
import { CalyxExperienceRepositoryUnavailableError } from "./experience-calyx-repository.server";
import { getExperienceRepository } from "./experience-repository-factory.server";
import {
  ExperienceConflictError,
  ExperienceNotFoundError,
} from "./experience-repository";
import {
  ExperienceTraceVerificationError,
  resolveExperienceIngestHmacSecret,
  verifySynapseTraceEnvelope,
} from "./experience-trace.server";

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

export async function ingestExperienceTrace(
  ownerId: string,
  envelopeInput: unknown,
): Promise<ExperienceCandidate> {
  const secret = resolveExperienceIngestHmacSecret();
  if (!secret) {
    throw new ExperienceIngestUnavailableError();
  }

  const envelope = verifySynapseTraceEnvelope(envelopeInput, secret);
  return getExperienceRepository().ingestTraceCandidate(ownerId, envelope);
}

export async function listExperienceCandidates(
  ownerId: string,
  status?: string,
): Promise<ExperienceCandidate[]> {
  return getExperienceRepository().listCandidates(ownerId, status);
}

export async function getExperienceCandidateSnapshot(
  ownerId: string,
): Promise<ExperienceCandidateSnapshot> {
  return getExperienceRepository().getCandidateSnapshot(ownerId);
}

export function mapExperienceServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
  details?: string[];
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
  if (error instanceof ExperienceConflictError) {
    return { status: 409, code: "CONFLICT", message: error.message };
  }
  if (error instanceof CalyxExperienceRepositoryUnavailableError) {
    return { status: 503, code: "REPOSITORY_UNAVAILABLE", message: error.message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Unexpected server error" };
}

export {
  ExperienceConflictError,
  ExperienceNotFoundError,
  ExperienceTraceVerificationError,
  CalyxExperienceRepositoryUnavailableError,
};
