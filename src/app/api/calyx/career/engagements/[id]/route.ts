import { careerJson } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import {
  deleteClientEngagement,
  updateClientEngagement,
} from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const engagement = await updateClientEngagement(ownerId, id, body);
    return careerJson(engagement);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveCareerOwnerId();
    await deleteClientEngagement(ownerId, id);
    return careerJson({ deleted: true });
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
