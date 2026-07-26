import { experienceJson } from "@/lib/calyx/domains/experience/experience-api.server";
import { resolveExperienceOwnerId } from "@/lib/calyx/domains/experience/experience-owner.server";
import { handleExperienceRouteError } from "@/lib/calyx/domains/experience/experience-route-utils.server";
import {
  ExperienceValidationError,
  listExperienceDomainEvents,
} from "@/lib/calyx/domains/experience/experience-service.server";
import { validateExperienceEventsQuery } from "@/lib/calyx/domains/experience/experience-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = resolveExperienceOwnerId();
    const url = new URL(request.url);
    const query = validateExperienceEventsQuery({
      candidateId: url.searchParams.get("candidateId") ?? undefined,
    });
    if (!query.ok) {
      throw new ExperienceValidationError(query.errors);
    }
    const events = await listExperienceDomainEvents(ownerId, query.value.candidateId);
    return experienceJson({ events });
  } catch (error) {
    return handleExperienceRouteError(error);
  }
}
