import type { ExperienceRepository } from "./experience-repository";

export class CalyxExperienceRepositoryUnavailableError extends Error {
  constructor(message = "Calyx experience repository capabilities are unavailable") {
    super(message);
    this.name = "CalyxExperienceRepositoryUnavailableError";
  }
}

export class CalyxExperienceRepository implements ExperienceRepository {
  constructor(private readonly reason: string) {}

  private unavailable(): never {
    throw new CalyxExperienceRepositoryUnavailableError(this.reason);
  }

  ingestTraceCandidate(_ownerId: string, _envelope: unknown): Promise<never> {
    return Promise.reject(this.unavailable());
  }

  listCandidates(_ownerId: string, _status?: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }

  getCandidateSnapshot(_ownerId: string): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}

export async function probeCalyxExperienceRepositoryCapabilities(): Promise<{
  available: boolean;
  reason?: string;
}> {
  return {
    available: false,
    reason: "External Calyx experience persistence contract is not verified",
  };
}
