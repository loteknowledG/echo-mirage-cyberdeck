import type { ExperienceStorageMode } from "./experience-types";
import type { ExperienceRepository } from "./experience-repository";
import {
  CalyxExperienceRepository,
  probeCalyxExperienceRepositoryCapabilities,
} from "./experience-calyx-repository.server";
import { LocalExperienceRepository } from "./experience-local-repository.server";

let repositoryOverride: ExperienceRepository | null = null;
let experienceRootOverride: string | undefined;

export function resolveExperienceStorageMode(): ExperienceStorageMode {
  const raw = process.env.CALYX_EXPERIENCE_STORAGE?.trim().toLowerCase();
  if (raw === "calyx") return "calyx";
  return "local";
}

export function setExperienceRepositoryForTests(
  repository: ExperienceRepository | null,
  rootOverride?: string,
): void {
  repositoryOverride = repository;
  experienceRootOverride = rootOverride;
}

export function resetExperienceRepositoryForTests(): void {
  repositoryOverride = null;
  experienceRootOverride = undefined;
}

export function getExperienceRepository(): ExperienceRepository {
  if (repositoryOverride) {
    return repositoryOverride;
  }

  const mode = resolveExperienceStorageMode();
  if (mode === "local") {
    return new LocalExperienceRepository(experienceRootOverride);
  }

  return new CalyxExperienceRepository(
    "Calyx experience repository selected; use async initialization to probe capabilities",
  );
}

export async function getExperienceRepositoryAsync(): Promise<ExperienceRepository> {
  const mode = resolveExperienceStorageMode();
  if (mode === "calyx") {
    const probe = await probeCalyxExperienceRepositoryCapabilities();
    if (!probe.available) {
      return new CalyxExperienceRepository(
        probe.reason ??
          "Calyx experience repository selected but required capabilities are unavailable",
      );
    }
  }
  return getExperienceRepository();
}
