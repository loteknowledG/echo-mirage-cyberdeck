import { careerJson } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import {
  deleteProjectRecord,
  updateProjectRecord,
} from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const project = await updateProjectRecord(ownerId, id, body);
    return careerJson(project);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = resolveCareerOwnerId();
    await deleteProjectRecord(ownerId, id);
    return careerJson({ deleted: true });
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
