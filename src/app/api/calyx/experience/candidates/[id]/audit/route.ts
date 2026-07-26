import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import { handleExperienceRouteError } from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { listExperienceReviewAudit } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveExperienceOwnerId();
    const audit = await listExperienceReviewAudit(ownerId, id);
    return experienceJson({ audit });
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
