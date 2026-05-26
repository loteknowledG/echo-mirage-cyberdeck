"use client";

import { useEffect, useState } from "react";

/**
 * Deck content surface mode. Does not affect fixed asciimorphism chrome (rail, headers).
 *
 * - `realmorphism` — content controls use the Realmorphism plane system (when wired).
 * - `ascii`        — wireframe override on the content zone only (NOT asciimorphism;
 *                     does not change ASCII-art components on rail/headers).
 */
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

/** Sync deck content mode from the cyberdeck root [data-deck-mode] attribute. */
export function useDeckMode(): DeckMode {
  const [mode, setMode] = useState<DeckMode>(() => loadDeckMode());

  useEffect(() => {
    const root = document.querySelector("[data-deck-mode]");
    if (!root) return;

    const sync = () => {
      setMode(normalizeDeckMode(root.getAttribute("data-deck-mode")));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-deck-mode"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}
