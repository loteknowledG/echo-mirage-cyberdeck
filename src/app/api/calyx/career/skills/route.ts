import { careerCreated } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import {
  handleCareerRouteError,
  parseJsonBody,
} from "@/lib/calyx/domains/career/career-route-utils.server";
import { addSkillEvidence } from "@/lib/calyx/domains/career/career-service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = resolveCareerOwnerId();
    const body = await parseJsonBody(request);
    const skill = await addSkillEvidence(ownerId, body);
    return careerCreated(skill);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
