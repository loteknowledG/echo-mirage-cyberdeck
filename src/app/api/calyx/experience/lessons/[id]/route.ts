import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import { handleExperienceRouteError } from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { getExperienceLesson } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveExperienceOwnerId();
    const lesson = await getExperienceLesson(ownerId, id);
    return experienceJson({ lesson });
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
