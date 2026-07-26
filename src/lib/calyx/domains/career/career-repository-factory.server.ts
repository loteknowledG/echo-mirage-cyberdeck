import type { CareerStorageMode } from "./career-types";
import type { CareerRepository } from "./career-repository";
import {
  CalyxCareerRepository,
  probeCalyxCareerRepositoryCapabilities,
} from "./career-calyx-repository.server";
import { LocalCareerRepository } from "./career-local-repository.server";

let repositoryOverride: CareerRepository | null = null;
let careerRootOverride: string | undefined;

export function resolveCareerStorageMode(): CareerStorageMode {
  const raw = process.env.CALYX_CAREER_STORAGE?.trim().toLowerCase();
  if (raw === "calyx") return "calyx";
  return "local";
}

export function setCareerRepositoryForTests(
  repository: CareerRepository | null,
  rootOverride?: string,
): void {
  repositoryOverride = repository;
  careerRootOverride = rootOverride;
}

export function resetCareerRepositoryForTests(): void {
  repositoryOverride = null;
  careerRootOverride = undefined;
}

export function getCareerRepository(): CareerRepository {
  if (repositoryOverride) {
    return repositoryOverride;
  }

  const mode = resolveCareerStorageMode();
  if (mode === "local") {
    return new LocalCareerRepository(careerRootOverride);
  }

  return new CalyxCareerRepository(
    "Calyx career repository selected; use async initialization to probe capabilities",
  );
}

export async function getCareerRepositoryAsync(): Promise<CareerRepository> {
  const mode = resolveCareerStorageMode();
  if (mode === "calyx") {
    const probe = await probeCalyxCareerRepositoryCapabilities();
    if (!probe.available) {
      return new CalyxCareerRepository(
        probe.reason ??
          "Calyx career repository selected but required capabilities are unavailable",
      );
    }
  }
  return getCareerRepository();
}
