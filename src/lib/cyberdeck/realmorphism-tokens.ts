/**
 * CSS custom property names for the cyberdeck Realmorphism system.
 * Values live in `src/styles/cyberdeck-realmorphism.css`.
 *
 * Scope: content zone only ([data-morphism="realmorphism"]).
 * Asciimorphism chrome (rail, headers) uses [data-morphism="asciimorphism"].
 */
export const REALMORPHISM_TOKENS = {
  host: "--realmorphism-host",
  hostRaised: "--realmorphism-host-raised",
  hostForeground: "--realmorphism-host-foreground",
  wall: "--realmorphism-wall",
  wallHover: "--realmorphism-wall-hover",
  wallAmber: "--realmorphism-wall-amber",
  wallAmberHover: "--realmorphism-wall-amber-hover",
  wallCritical: "--realmorphism-wall-critical",
  wallCriticalHover: "--realmorphism-wall-critical-hover",
  face: "--realmorphism-face",
  faceForeground: "--realmorphism-face-foreground",
  faceBorder: "--realmorphism-face-border",
  faceActive: "--realmorphism-face-active",
  faceActiveForeground: "--realmorphism-face-active-foreground",
  faceActiveBorder: "--realmorphism-face-active-border",
  faceAmber: "--realmorphism-face-amber",
  faceAmberForeground: "--realmorphism-face-amber-foreground",
  faceAmberBorder: "--realmorphism-face-amber-border",
  inkOnHost: "--realmorphism-ink-on-host",
  inkOnHostMuted: "--realmorphism-ink-on-host-muted",
  inkOnFace: "--realmorphism-ink-on-face",
  inkOnFaceActive: "--realmorphism-ink-on-face-active",
  inkOnFaceAmber: "--realmorphism-ink-on-face-amber",
  glyphRest: "--realmorphism-glyph-rest",
  glyphHover: "--realmorphism-glyph-hover",
  glyphActive: "--realmorphism-glyph-active",
  inkSignal: "--realmorphism-ink-signal",
  inkCaution: "--realmorphism-ink-caution",
  inkCritical: "--realmorphism-ink-critical",
  inkDisabled: "--realmorphism-ink-disabled",
  inset: "--realmorphism-inset",
  insetActive: "--realmorphism-inset-active",
  shadowRest: "--realmorphism-shadow-rest",
  shadowHover: "--realmorphism-shadow-hover",
  shadowAmberRest: "--realmorphism-shadow-amber-rest",
  shadowAmberHover: "--realmorphism-shadow-amber-hover",
  shadowInset: "--realmorphism-shadow-inset",
  shadowInsetActive: "--realmorphism-shadow-inset-active",
  radius: "--realmorphism-radius",
  radiusSm: "--realmorphism-radius-sm",
} as const;

export type RealmorphismToken = (typeof REALMORPHISM_TOKENS)[keyof typeof REALMORPHISM_TOKENS];

/** Reference `var(--token)` inside Tailwind arbitrary values or inline styles. */
export function realmorphismVar(token: RealmorphismToken): string {
  return `var(${token})`;
}
