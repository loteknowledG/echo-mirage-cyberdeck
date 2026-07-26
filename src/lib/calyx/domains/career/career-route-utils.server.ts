import { resolveCareerOwnerId } from "@/lib/calyx/domains/career/career-owner.server";
import { careerError } from "@/lib/calyx/domains/career/career-api.server";
import { mapCareerServiceError } from "@/lib/calyx/domains/career/career-service.server";

export async function withCareerOwner<T>(
  handler: (ownerId: string) => Promise<T>,
): Promise<T> {
  const ownerId = resolveCareerOwnerId();
  return handler(ownerId);
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CareerRouteError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
}

export class CareerRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "CareerRouteError";
  }
}

export function handleCareerRouteError(error: unknown) {
  if (error instanceof CareerRouteError) {
    return careerError(error.code, error.message, error.status, error.details);
  }
  const mapped = mapCareerServiceError(error);
  return careerError(mapped.code, mapped.message, mapped.status, mapped.details);
}
