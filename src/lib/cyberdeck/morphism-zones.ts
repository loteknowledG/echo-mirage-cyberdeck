/**
 * Cyberdeck morphism zones — asciimorphism and realmorphism do not mix.
 *
 * Reference: `f:\dev\asciimorphism` — ASCII art *as* components (rail tab frames,
 * pane labels, echo/mirage logos). Not the same as deck-mode `ascii` (wireframe override).
 *
 * - `asciimorphism` — fixed chrome built from ASCII art components (rail, headers).
 *                       Never receives realmorphism tokens or wireframe overrides.
 * - `realmorphism`  — content / control surface where deck mode applies.
 *                       Realmorphism (3D shadow controls) or wireframe override.
 */
export const MORPHISM_ZONE_ASCIIMORPHISM = "asciimorphism" as const;
export const MORPHISM_ZONE_REALMORPHISM = "realmorphism" as const;

export type MorphismZone =
  | typeof MORPHISM_ZONE_ASCIIMORPHISM
  | typeof MORPHISM_ZONE_REALMORPHISM;
