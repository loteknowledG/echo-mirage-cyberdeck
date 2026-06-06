"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Deck content surface mode. Does not affect fixed asciimorphism chrome (rail, headers).
 *
 * - `realmorphism` — 3D shadow controls in the content zone.
 * - `ascii`        — asciimorphism mechanical depth on content controls.
 */
export type DeckMode = "realmorphism" | "ascii";

export const DECK_MODE_STORAGE_KEY = "echo-mirage-deck-mode-v1";
export const DECK_MODE_CHANGE_EVENT = "echo-mirage-deck-mode-change";

const DeckModeContext = createContext<DeckMode | null>(null);

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

export function notifyDeckModeChange(mode: DeckMode) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DECK_MODE_CHANGE_EVENT, { detail: mode }));
}

export function DeckModeProvider({
  mode,
  children,
}: {
  mode: DeckMode;
  children: ReactNode;
}) {
  return createElement(DeckModeContext.Provider, { value: mode }, children);
}

/** Prefer DeckModeProvider; falls back to DOM attribute + storage + change events. */
export function useDeckMode(): DeckMode {
  const fromContext = useContext(DeckModeContext);
  const [fallbackMode, setFallbackMode] = useState<DeckMode>(() => loadDeckMode());

  useEffect(() => {
    if (fromContext !== null) return;

    let observer: MutationObserver | null = null;
    let cancelled = false;
    let pollId: number | null = null;

    const syncFromRoot = (root: Element) => {
      setFallbackMode(normalizeDeckMode(root.getAttribute("data-deck-mode")));
    };

    const attach = () => {
      const root = document.querySelector("[data-deck-mode]");
      if (!root) return false;
      syncFromRoot(root);
      observer?.disconnect();
      observer = new MutationObserver(() => syncFromRoot(root));
      observer.observe(root, { attributes: true, attributeFilter: ["data-deck-mode"] });
      return true;
    };

    if (!attach()) {
      pollId = window.setInterval(() => {
        if (cancelled) return;
        if (attach() && pollId !== null) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 100);
    }

    const onDeckModeEvent = (event: Event) => {
      const detail = (event as CustomEvent<DeckMode>).detail;
      if (detail) setFallbackMode(normalizeDeckMode(detail));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === DECK_MODE_STORAGE_KEY) {
        setFallbackMode(normalizeDeckMode(event.newValue));
      }
    };

    window.addEventListener(DECK_MODE_CHANGE_EVENT, onDeckModeEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      observer?.disconnect();
      window.removeEventListener(DECK_MODE_CHANGE_EVENT, onDeckModeEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [fromContext]);

  return fromContext ?? fallbackMode;
}
