import { getCalyxStatus } from "@/lib/calyx/calyx-status";
import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import type { ExperienceStatusPayload } from "@/lib/calyx/domains/experience/experience-api-types";
import { probeCalyxExperienceRepositoryCapabilities } from "@/lib/calyx/domains/experience/experience-calyx-repository.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import { resolveExperienceStorageMode } from "@/lib/calyx/domains/experience/experience-repository-factory.server";
import { getExperienceOperationalMetrics } from "@/lib/calyx/domains/experience/experience-service.server";
import { SYNAPSE_TRACE_ENVELOPE_CONTRACT } from "@/lib/calyx/domains/experience/experience-types";
import { resolveExperienceIngestHmacSecret } from "@/lib/calyx/domains/experience/experience-trace.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const calyx = await getCalyxStatus();
  const storageMode = resolveExperienceStorageMode();
  const probe = await probeCalyxExperienceRepositoryCapabilities();
  const repositoryAvailable = storageMode === "local" || probe.available;
  const ingestConfigured = Boolean(resolveExperienceIngestHmacSecret());
  const ownerId = resolveExperienceOwnerId();
  const metrics = await getExperienceOperationalMetrics(ownerId);

  const payload: ExperienceStatusPayload = {
    storageMode,
    calyxStatus: calyx.status,
    calyxEnabled: calyx.enabled,
    repositoryAvailable,
    ingestConfigured,
    traceContractVersion: SYNAPSE_TRACE_ENVELOPE_CONTRACT,
    metrics,
  };

  return experienceJson(payload);
}
