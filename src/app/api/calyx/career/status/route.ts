import { getCalyxStatus } from "@/lib/calyx/calyx-status";
import { careerJson } from "@/lib/calyx/domains/career/career-api.server";
import type { CareerStatusPayload } from "@/lib/calyx/domains/career/career-api-types";
import { probeCalyxCareerRepositoryCapabilities } from "@/lib/calyx/domains/career/career-calyx-repository.server";
import { resolveCareerStorageMode } from "@/lib/calyx/domains/career/career-repository-factory.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const calyx = await getCalyxStatus();
  const storageMode = resolveCareerStorageMode();
  const probe = await probeCalyxCareerRepositoryCapabilities();
  const repositoryAvailable = storageMode === "local" || probe.available;

  const payload: CareerStatusPayload = {
    storageMode,
    calyxStatus: calyx.status,
    calyxEnabled: calyx.enabled,
    repositoryAvailable,
  };

  return careerJson(payload);
}
