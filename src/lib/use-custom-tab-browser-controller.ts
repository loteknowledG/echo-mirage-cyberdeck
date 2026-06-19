"use client";

import { useCallback, useEffect } from "react";
import type { RefObject } from "react";
import { normalizeOperatorBrowserUrl } from "@/lib/browser-intents";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";

type CustomTabBrowserKind =
  | "blank"
  | "document"
  | "web"
  | "settings"
  | "connection"
  | "pi"
  | "diagnostics"
  | "catalog"
  | "catelog"
  | "operators"
  | "memory-atlas"
  | "voice-lab"
  | "flight-log"
  | "glyph-channel"
  | "rola-dex"
  | "tunes";

type CustomTabBrowserState = {
  id: string;
  label: string;
  glyph: string;
  kind: CustomTabBrowserKind;
  browserUrl?: string;
  asset?: unknown;
};

type UpdateCustomTab = (tabId: string, updater: (tab: CustomTabBrowserState) => CustomTabBrowserState) => void;

type UseCustomTabBrowserControllerArgs = {
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  updateCustomTab: UpdateCustomTab;
};

function readActiveWebTab() {
  const { activeCustomTabId, customTabs } = useCyberdeckTabStore.getState();
  if (!activeCustomTabId) return null;
  const tab = customTabs.find((t) => t.id === activeCustomTabId) ?? null;
  if (!tab || tab.kind !== "web") return null;
  return tab;
}

/** Store subscription only — mount in a leaf component so the page shell does not re-render. */
export function useCustomTabBrowserController({
  operatorBrowserRef,
  updateCustomTab,
}: UseCustomTabBrowserControllerArgs) {
  const handleCustomTabBrowserNavigate = useCallback(
    (tabId: string, nextUrl: string) => {
      const normalizedUrl = normalizeOperatorBrowserUrl(nextUrl);
      updateCustomTab(tabId, (tab) => ({
        ...tab,
        kind: "web",
        browserUrl: normalizedUrl,
        asset: undefined,
      }));
    },
    [updateCustomTab],
  );

  useEffect(() => {
    const attach = () => {
      const activeCustomTab = readActiveWebTab();
      if (!activeCustomTab) return undefined;
      const view = operatorBrowserRef.current;
      if (!view) return undefined;

      view.setAttribute("allowpopups", "");

      const syncUrl = () => {
        try {
          const currentUrl = view.getURL();
          if (currentUrl) {
            handleCustomTabBrowserNavigate(activeCustomTab.id, currentUrl);
          }
        } catch {
          /* ignore */
        }
      };

      const blockDrop = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
      };

      view.addEventListener("did-navigate", syncUrl as EventListener);
      view.addEventListener("did-navigate-in-page", syncUrl as EventListener);
      view.addEventListener("page-title-updated", syncUrl as EventListener);
      view.addEventListener("dragover", blockDrop);
      view.addEventListener("drop", blockDrop);

      return () => {
        view.removeEventListener("did-navigate", syncUrl as EventListener);
        view.removeEventListener("did-navigate-in-page", syncUrl as EventListener);
        view.removeEventListener("page-title-updated", syncUrl as EventListener);
        view.removeEventListener("dragover", blockDrop);
        view.removeEventListener("drop", blockDrop);
      };
    };

    let cleanup = attach();
    return useCyberdeckTabStore.subscribe((state, prev) => {
      if (
        state.activeCustomTabId === prev.activeCustomTabId &&
        state.customTabs === prev.customTabs
      ) {
        return;
      }
      cleanup?.();
      cleanup = attach();
    });
  }, [handleCustomTabBrowserNavigate, operatorBrowserRef]);

  return {
    handleCustomTabBrowserNavigate,
  };
}
