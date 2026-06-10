"use client";

/** Legacy hook — deck always runs Echo Mirage (no separate app profiles). */
export type DeckAppId = "echo-mirage";

export function useDeckApp(): DeckAppId {
  return "echo-mirage";
}
