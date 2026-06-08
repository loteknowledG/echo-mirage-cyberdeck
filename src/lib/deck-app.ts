"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type DeckAppId = "echo-mirage" | "property-management";

export const DECK_APP_STORAGE_KEY = "echo-mirage-deck-app-v1";
export const DECK_APP_CHANGE_EVENT = "echo-mirage-deck-app-change";

const DECK_APP_IDS: readonly DeckAppId[] = ["echo-mirage", "property-management"];

const DeckAppContext = createContext<DeckAppId | null>(null);

export function normalizeDeckAppId(value: unknown): DeckAppId {
  if (typeof value === "string" && (DECK_APP_IDS as readonly string[]).includes(value)) {
    return value as DeckAppId;
  }
  return "echo-mirage";
}

export function loadDeckApp(): DeckAppId {
  if (typeof window === "undefined") return "echo-mirage";
  try {
    return normalizeDeckAppId(window.localStorage.getItem(DECK_APP_STORAGE_KEY));
  } catch {
    return "echo-mirage";
  }
}

export function saveDeckApp(appId: DeckAppId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DECK_APP_STORAGE_KEY, appId);
  } catch {
    // ignore storage write failures
  }
}

export function notifyDeckAppChange(appId: DeckAppId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DECK_APP_CHANGE_EVENT, { detail: appId }));
}

export function DeckAppProvider({
  appId,
  children,
}: {
  appId: DeckAppId;
  children: ReactNode;
}) {
  return createElement(DeckAppContext.Provider, { value: appId }, children);
}

/** Prefer DeckAppProvider; falls back to DOM attribute + storage + change events. */
export function useDeckApp(): DeckAppId {
  const fromContext = useContext(DeckAppContext);
  const [fallbackApp, setFallbackApp] = useState<DeckAppId>(() => loadDeckApp());

  useEffect(() => {
    if (fromContext !== null) return;

    let observer: MutationObserver | null = null;
    let cancelled = false;
    let pollId: number | null = null;

    const syncFromRoot = (root: Element) => {
      setFallbackApp(normalizeDeckAppId(root.getAttribute("data-deck-app")));
    };

    const attach = () => {
      const root = document.querySelector("[data-deck-app]");
      if (!root) return false;
      syncFromRoot(root);
      observer?.disconnect();
      observer = new MutationObserver(() => syncFromRoot(root));
      observer.observe(root, { attributes: true, attributeFilter: ["data-deck-app"] });
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

    const onDeckAppEvent = (event: Event) => {
      const detail = (event as CustomEvent<DeckAppId>).detail;
      if (detail) setFallbackApp(normalizeDeckAppId(detail));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === DECK_APP_STORAGE_KEY) {
        setFallbackApp(normalizeDeckAppId(event.newValue));
      }
    };

    window.addEventListener(DECK_APP_CHANGE_EVENT, onDeckAppEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      observer?.disconnect();
      window.removeEventListener(DECK_APP_CHANGE_EVENT, onDeckAppEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [fromContext]);

  return fromContext ?? fallbackApp;
}
