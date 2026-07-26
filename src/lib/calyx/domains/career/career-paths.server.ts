import path from "node:path";
import { resolveCalyxHome } from "@/lib/calyx/calyx-config.server";
import { validateOwnerId } from "./career-validation";

const CAREER_DOMAIN_SEGMENT = "echo-mirage-domains";
const CAREER_SEGMENT = "career";

export function resolveCareerDomainRoot(): string {
  return path.join(resolveCalyxHome(), CAREER_DOMAIN_SEGMENT, CAREER_SEGMENT);
}

export function resolveOwnerCareerDir(ownerId: string): string {
  const validated = validateOwnerId(ownerId);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }
  const safeOwnerId = validated.value;
  const root = path.resolve(resolveCareerDomainRoot());
  const ownerDir = path.resolve(root, safeOwnerId);
  if (
    ownerDir !== root &&
    !ownerDir.startsWith(`${root}${path.sep}`)
  ) {
    throw new Error("Invalid owner directory");
  }
  return ownerDir;
}

export function assertSafeOwnerId(ownerId: string): string {
  const validated = validateOwnerId(ownerId);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }
  return validated.value;
}
