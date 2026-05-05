"use client";

import { useCallback, useEffect } from "react";
import type { RefObject } from "react";
import { normalizeOperatorBrowserUrl } from "@/lib/browser-intents";

type CustomTabBrowserKind = "blank" | "document" | "web" | "settings" | "connection" | "pi";

type CustomTabBrowserState = {
  id: string;
  label: string;
  glyph: string;
  kind: CustomTabBrowserKind;
  browserUrl?: string;
  asset?: any;
};

type UpdateCustomTab = (tabId: string, updater: (tab: CustomTabBrowserState) => CustomTabBrowserState) => void;

type UseCustomTabBrowserControllerArgs = {
  activeCustomTab: CustomTabBrowserState | null;
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  updateCustomTab: UpdateCustomTab;
};

export function useCustomTabBrowserController({
  activeCustomTab,
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
    if (!activeCustomTab || activeCustomTab.kind !== "web") return;
    const view = operatorBrowserRef.current;
    if (!view) return;

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
  }, [activeCustomTab, handleCustomTabBrowserNavigate, operatorBrowserRef]);

  return {
    handleCustomTabBrowserNavigate,
  };
}
