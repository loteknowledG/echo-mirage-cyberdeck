import { careerJson } from "@/lib/calyx/domains/career/career-api.server";
import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import { getCareerPortfolio } from "@/lib/calyx/domains/career/career-service.server";
import { handleCareerRouteError } from "@/lib/calyx/domains/career/career-route-utils.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = resolveCareerOwnerId();
    const portfolio = await getCareerPortfolio(ownerId);
    return careerJson(portfolio);
  } catch (error) {
    return handleCareerRouteError(error);
  }
}
