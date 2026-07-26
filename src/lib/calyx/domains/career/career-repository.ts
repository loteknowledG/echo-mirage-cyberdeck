import type {
  CareerAccomplishment,
  CareerEvidence,
  CareerEvidenceLink,
  CareerEvidenceRecordType,
  CareerPortfolioSnapshot,
  CareerProfile,
  CareerProject,
  CareerTimelineEntry,
  CertificationRecord,
  ClientEngagement,
  EducationRecord,
  Employer,
  CareerSkillEvidence,
} from "./career-types";
import type {
  CreateCareerAccomplishmentInput,
  CreateCareerEvidenceInput,
  CreateCareerEvidenceLinkInput,
  CreateCareerProjectInput,
  CreateCareerSkillEvidenceInput,
  CreateEmployerInput,
  CreateEngagementInput,
  UpdateCareerAccomplishmentInput,
  UpdateCareerProfileInput,
  UpdateCareerProjectInput,
  UpdateEmployerInput,
  UpdateEngagementInput,
} from "./career-validation";

export class CareerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareerNotFoundError";
  }
}

export class CareerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareerConflictError";
  }
}

export interface CareerRepository {
  getOrCreateProfile(ownerId: string): Promise<CareerProfile>;
  updateProfile(ownerId: string, input: UpdateCareerProfileInput): Promise<CareerProfile>;
  getPortfolio(ownerId: string): Promise<CareerPortfolioSnapshot>;
  createEmployer(ownerId: string, input: CreateEmployerInput): Promise<Employer>;
  updateEmployer(
    ownerId: string,
    employerId: string,
    input: UpdateEmployerInput,
  ): Promise<Employer>;
  deleteEmployer(ownerId: string, employerId: string): Promise<void>;
  createEngagement(ownerId: string, input: CreateEngagementInput): Promise<ClientEngagement>;
  updateEngagement(
    ownerId: string,
    engagementId: string,
    input: UpdateEngagementInput,
  ): Promise<ClientEngagement>;
  deleteEngagement(ownerId: string, engagementId: string): Promise<void>;
  createProject(ownerId: string, input: CreateCareerProjectInput): Promise<CareerProject>;
  updateProject(
    ownerId: string,
    projectId: string,
    input: UpdateCareerProjectInput,
  ): Promise<CareerProject>;
  deleteProject(ownerId: string, projectId: string): Promise<void>;
  createAccomplishment(
    ownerId: string,
    input: CreateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment>;
  updateAccomplishment(
    ownerId: string,
    accomplishmentId: string,
    input: UpdateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment>;
  deleteAccomplishment(ownerId: string, accomplishmentId: string): Promise<void>;
  addSkillEvidence(
    ownerId: string,
    input: CreateCareerSkillEvidenceInput,
  ): Promise<CareerSkillEvidence>;
  addEvidence(ownerId: string, input: CreateCareerEvidenceInput): Promise<CareerEvidence>;
  linkEvidence(
    ownerId: string,
    input: CreateCareerEvidenceLinkInput,
  ): Promise<CareerEvidenceLink>;
  verifyRecord(
    ownerId: string,
    recordType: CareerEvidenceRecordType,
    recordId: string,
  ): Promise<void>;
  listTimeline(ownerId: string): Promise<CareerTimelineEntry[]>;
}

export type CareerPortfolioData = {
  profile: CareerProfile;
  employers: Employer[];
  engagements: ClientEngagement[];
  projects: CareerProject[];
  accomplishments: CareerAccomplishment[];
  skills: CareerSkillEvidence[];
  evidence: CareerEvidence[];
  evidenceLinks: CareerEvidenceLink[];
  education: EducationRecord[];
  certifications: CertificationRecord[];
};
