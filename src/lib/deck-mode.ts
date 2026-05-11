"use client";

export type DeckMode = "realmorphism" | "ascii";

export const DECK_MODE_STORAGE_KEY = "echo-mirage-deck-mode-v1";

export function normalizeDeckMode(value: unknown): DeckMode {
  return value === "ascii" ? "ascii" : "realmorphism";
}

export function loadDeckMode(): DeckMode {
  if (typeof window === "undefined") return "realmorphism";
  try {
    return normalizeDeckMode(window.localStorage.getItem(DECK_MODE_STORAGE_KEY));
  } catch {
    return "realmorphism";
  }
}

export function saveDeckMode(mode: DeckMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DECK_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage write failures
  }
}
