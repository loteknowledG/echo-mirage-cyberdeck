"use client";

import { useEffect, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDebouncedEffect } from "@/lib/use-debounced-effect";
import { useCyberdeckTabStore, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { saveWorkspaceState } from "@/lib/workspace-state";

type CyberdeckTabPersistenceProps = {
  uiStateStorageKey: string;
  workspaceHydrated: boolean;
  deckUiHydrated: boolean;
  serverRef: MutableRefObject<CyberdeckServerId>;
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: CyberdeckServerId | null;
  operatorSurfaceMode: "workspace" | "browser";
  operatorBrowserUrl: string;
  buildUiPayload: () => Record<string, unknown>;
};

/** Subscribes to tab store for localStorage — persistence off the main page render path. */
export function CyberdeckTabPersistence({
  uiStateStorageKey,
  workspaceHydrated,
  deckUiHydrated,
  serverRef,
  navRailContext,
  serverKeyboardHighlightId,
  operatorSurfaceMode,
  operatorBrowserUrl,
  buildUiPayload,
}: CyberdeckTabPersistenceProps) {
  const { server, activeCustomTabId, customTabs } = useCyberdeckTabStore(
    useShallow((state) => ({
      server: state.server,
      activeCustomTabId: state.activeCustomTabId,
      customTabs: state.customTabs,
    })),
  );

  useEffect(() => {
    serverRef.current = server;
  }, [server, serverRef]);

  useDebouncedEffect(
    () => {
      if (!deckUiHydrated) return;
      try {
        window.localStorage.setItem(uiStateStorageKey, JSON.stringify(buildUiPayload()));
      } catch {
        /* ignore */
      }
    },
    [deckUiHydrated, navRailContext, operatorBrowserUrl, operatorSurfaceMode, server, serverKeyboardHighlightId, activeCustomTabId, customTabs],
    300,
  );

  useDebouncedEffect(
    () => {
      if (!workspaceHydrated) return;
      saveWorkspaceState({
        activeModuleId: activeCustomTabId ?? server,
        customTabs,
        activeCustomTabId,
      });
    },
    [workspaceHydrated, activeCustomTabId, customTabs, server],
    300,
  );

  return null;
}
