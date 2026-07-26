import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import {
  handleExperienceRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { reviewExperienceCandidate } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveExperienceOwnerId();
    const body = await parseJsonBody(request);
    const result = await reviewExperienceCandidate(ownerId, id, body);
    return experienceJson(result);
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
