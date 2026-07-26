import { experienceCreated } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import {
  handleExperienceRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/experience/experience-route-utils.server";
import { ingestExperienceTrace } from "@/lib/calyx/domains/experience/experience-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = resolveExperienceOwnerId();
    const body = await parseJsonBody(request);
    const candidate = await ingestExperienceTrace(ownerId, body);
    return experienceCreated(candidate);
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
