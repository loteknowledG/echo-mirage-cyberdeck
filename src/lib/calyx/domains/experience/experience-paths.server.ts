import path from "node:path";
import { resolveCalyxHome } from "@/lib/calyx/calyx-config.server";
import { validateOwnerId, validateTraceId } from "./experience-validation";

const EXPERIENCE_DOMAIN_SEGMENT = "echo-mirage-domains";
const EXPERIENCE_SEGMENT = "experience";

export function resolveExperienceDomainRoot(): string {
  return path.join(resolveCalyxHome(), EXPERIENCE_DOMAIN_SEGMENT, EXPERIENCE_SEGMENT);
}

export function resolveOwnerExperienceDir(ownerId: string): string {
  const validated = validateOwnerId(ownerId);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }
  const safeOwnerId = validated.value;
  const root = path.resolve(resolveExperienceDomainRoot());
  const ownerDir = path.resolve(root, safeOwnerId);
  if (ownerDir !== root && !ownerDir.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid owner directory");
  }
  return ownerDir;
}

export function resolveOwnerTraceArtifactPath(ownerId: string, traceId: string): string {
  const validatedTraceId = validateTraceId(traceId);
  if (!validatedTraceId.ok) {
    throw new Error(validatedTraceId.errors.join("; "));
  }
  const ownerDir = resolveOwnerExperienceDir(ownerId);
  const tracesDir = path.resolve(ownerDir, "traces");
  const artifactPath = path.resolve(tracesDir, `${validatedTraceId.value}.json`);
  if (!artifactPath.startsWith(`${tracesDir}${path.sep}`)) {
    throw new Error("Invalid trace artifact path");
  }
  return artifactPath;
}

export function assertSafeOwnerId(ownerId: string): string {
  const validated = validateOwnerId(ownerId);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }
  return validated.value;
}
