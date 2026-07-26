import { careerCreated } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import { createClientEngagement } from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const engagement = await createClientEngagement(ownerId, body);
    return careerCreated(engagement);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
