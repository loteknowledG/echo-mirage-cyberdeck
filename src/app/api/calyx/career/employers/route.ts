import { careerCreated } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import { createEmployer } from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const employer = await createEmployer(ownerId, body);
    return careerCreated(employer);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
