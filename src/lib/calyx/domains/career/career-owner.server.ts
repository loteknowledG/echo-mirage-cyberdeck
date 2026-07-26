/**
 * Resolves the career portfolio owner for the current request context.
 * Multi-user authentication is deferred to L-CALYX-108.
 */
export function resolveCareerOwnerId(): string {
  return "local-operator";
}
