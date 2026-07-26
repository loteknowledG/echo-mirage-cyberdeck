import { careerCreated } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import { createProject } from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const project = await createProject(ownerId, body);
    return careerCreated(project);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
