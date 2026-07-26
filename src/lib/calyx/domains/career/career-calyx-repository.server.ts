import type { CareerRepository } from "./career-repository";

export const CALYX_CAREER_REQUIRED_CAPABILITIES = [
  "calyx.search",
  "calyx.ingest",
] as const;

export class CalyxCareerRepositoryUnavailableError extends Error {
  constructor(message = "Calyx career repository capabilities are unavailable") {
    super(message);
    this.name = "CalyxCareerRepositoryUnavailableError";
  }
}

export class CalyxCareerRepository implements CareerRepository {
  constructor(private readonly reason: string) {}

  private unavailable(): never {
    throw new CalyxCareerRepositoryUnavailableError(this.reason);
  }

  getOrCreateProfile(_ownerId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  updateProfile(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  getPortfolio(_ownerId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  createEmployer(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  updateEmployer(_ownerId: string, _employerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  deleteEmployer(_ownerId: string, _employerId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  createEngagement(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  updateEngagement(_ownerId: string, _engagementId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  deleteEngagement(_ownerId: string, _engagementId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  createProject(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  updateProject(_ownerId: string, _projectId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  deleteProject(_ownerId: string, _projectId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  createAccomplishment(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  updateAccomplishment(
    _ownerId: string,
    _accomplishmentId: string,
    _input: unknown,
  ): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  deleteAccomplishment(_ownerId: string, _accomplishmentId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  addSkillEvidence(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  addEvidence(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  linkEvidence(_ownerId: string, _input: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  verifyRecord(_ownerId: string, _recordType: unknown, _recordId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  listTimeline(_ownerId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}

export async function probeCalyxCareerRepositoryCapabilities(): Promise<{
  available: boolean;
  reason?: string;
}> {
  return {
    available: false,
    reason:
      "Verified Calyx MCP career persistence contracts are not available in L-CALYX-100",
  };
}
