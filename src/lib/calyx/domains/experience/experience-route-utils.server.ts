import { experienceError } from "@/lib/calyx/domains/experience/experience-api.server";
import { mapExperienceServiceError } from "@/lib/calyx/domains/experience/experience-service.server";

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ExperienceRouteError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
}

export class ExperienceRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ExperienceRouteError";
  }
}

export function handleExperienceRouteError(error: unknown) {
  if (error instanceof ExperienceRouteError) {
    return experienceError(error.code, error.message, error.status, error.details);
  }
  const mapped = mapExperienceServiceError(error);
  return experienceError(mapped.code, mapped.message, mapped.status, mapped.details);
}
