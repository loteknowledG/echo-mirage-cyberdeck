import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import {
  handleExperienceRouteError,
} from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { getExperienceCandidateSnapshot } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = resolveExperienceOwnerId();
    const snapshot = await getExperienceCandidateSnapshot(ownerId);
    return experienceJson(snapshot);
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
