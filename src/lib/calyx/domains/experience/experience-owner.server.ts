/**
 * Resolves the experience portfolio owner for the current request context.
 * Multi-user authentication is deferred to L-CALYX-108.
 */
export function resolveExperienceOwnerId(): string {
  return "local-operator";
}
