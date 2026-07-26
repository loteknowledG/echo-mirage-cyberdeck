import { experienceCreated, experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
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
    const result = await ingestExperienceTrace(ownerId, body);

    if (result.outcome === "created") {
      return experienceCreated(result);
    }
    if (result.outcome === "conflict") {
      return experienceJson(result, 409);
    }

    return experienceJson(result);
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
