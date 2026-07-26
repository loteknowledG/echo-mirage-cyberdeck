import type { CareerEvidenceRecordType, CareerPortfolioSnapshot } from "./career-types";
import { CalyxCareerRepositoryUnavailableError } from "./career-calyx-repository.server";
import { getCareerRepository } from "./career-repository-factory.server";
import { CareerConflictError, CareerNotFoundError } from "./career-repository";
import {
  validateCreateAccomplishment,
  validateCreateEmployer,
  validateCreateEngagement,
  validateCreateEvidence,
  validateCreateEvidenceLink,
  validateCreateProject,
  validateCreateSkillEvidence,
  validateUpdateAccomplishment,
  validateUpdateCareerProfile,
  validateUpdateEmployer,
  validateUpdateEngagement,
  validateUpdateProject,
  validateVerifyRecord,
} from "./career-validation";

export class CareerValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(details.join("; "));
    this.name = "CareerValidationError";
  }
}

function assertValidation<T>(
  result: { ok: true; value: T } | { ok: false; errors: string[] },
): T {
  if (!result.ok) {
    throw new CareerValidationError(result.errors);
  }
  return result.value;
}

export async function getCareerPortfolio(ownerId: string): Promise<CareerPortfolioSnapshot> {
  return getCareerRepository().getPortfolio(ownerId);
}

export async function updateCareerProfile(ownerId: string, input: unknown) {
  const value = assertValidation(validateUpdateCareerProfile(input));
  return getCareerRepository().updateProfile(ownerId, value);
}

export async function createEmployer(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateEmployer(input));
  return getCareerRepository().createEmployer(ownerId, value);
}

export async function updateEmployerRecord(ownerId: string, employerId: string, input: unknown) {
  const value = assertValidation(validateUpdateEmployer(input));
  return getCareerRepository().updateEmployer(ownerId, employerId, value);
}

export async function deleteEmployerRecord(ownerId: string, employerId: string) {
  return getCareerRepository().deleteEmployer(ownerId, employerId);
}

export async function createClientEngagement(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateEngagement(input));
  return getCareerRepository().createEngagement(ownerId, value);
}

export async function updateClientEngagement(
  ownerId: string,
  engagementId: string,
  input: unknown,
) {
  const value = assertValidation(validateUpdateEngagement(input));
  return getCareerRepository().updateEngagement(ownerId, engagementId, value);
}

export async function deleteClientEngagement(ownerId: string, engagementId: string) {
  return getCareerRepository().deleteEngagement(ownerId, engagementId);
}

export async function createProject(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateProject(input));
  return getCareerRepository().createProject(ownerId, value);
}

export async function updateProjectRecord(ownerId: string, projectId: string, input: unknown) {
  const value = assertValidation(validateUpdateProject(input));
  return getCareerRepository().updateProject(ownerId, projectId, value);
}

export async function deleteProjectRecord(ownerId: string, projectId: string) {
  return getCareerRepository().deleteProject(ownerId, projectId);
}

export async function createAccomplishment(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateAccomplishment(input));
  return getCareerRepository().createAccomplishment(ownerId, value);
}

export async function updateAccomplishmentRecord(
  ownerId: string,
  accomplishmentId: string,
  input: unknown,
) {
  const value = assertValidation(validateUpdateAccomplishment(input));
  return getCareerRepository().updateAccomplishment(ownerId, accomplishmentId, value);
}

export async function deleteAccomplishmentRecord(ownerId: string, accomplishmentId: string) {
  return getCareerRepository().deleteAccomplishment(ownerId, accomplishmentId);
}

export async function addSkillEvidence(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateSkillEvidence(input));
  return getCareerRepository().addSkillEvidence(ownerId, value);
}

export async function addCareerEvidence(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateEvidence(input));
  return getCareerRepository().addEvidence(ownerId, value);
}

export async function linkCareerEvidence(ownerId: string, input: unknown) {
  const value = assertValidation(validateCreateEvidenceLink(input));
  return getCareerRepository().linkEvidence(ownerId, value);
}

export async function verifyCareerRecord(
  ownerId: string,
  recordType: CareerEvidenceRecordType,
  recordId: string,
) {
  return getCareerRepository().verifyRecord(ownerId, recordType, recordId);
}

export async function verifyCareerRecordFromInput(ownerId: string, input: unknown) {
  const value = assertValidation(validateVerifyRecord(input));
  return verifyCareerRecord(ownerId, value.recordType, value.recordId);
}

export function mapCareerServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
  details?: string[];
} {
  if (error instanceof CareerValidationError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.details,
    };
  }
  if (error instanceof CareerNotFoundError) {
    return { status: 404, code: "NOT_FOUND", message: error.message };
  }
  if (error instanceof CareerConflictError) {
    return { status: 409, code: "CONFLICT", message: error.message };
  }
  if (error instanceof CalyxCareerRepositoryUnavailableError) {
    return { status: 503, code: "REPOSITORY_UNAVAILABLE", message: error.message };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "Unexpected server error" };
}

export {
  CareerConflictError,
  CareerNotFoundError,
  CalyxCareerRepositoryUnavailableError,
};
