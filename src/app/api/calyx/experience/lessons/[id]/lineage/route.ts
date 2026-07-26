import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import { handleExperienceRouteError } from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { getExperienceLessonLineage } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveExperienceOwnerId();
    const lineage = await getExperienceLessonLineage(ownerId, id);
    return experienceJson({ lineage });
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
