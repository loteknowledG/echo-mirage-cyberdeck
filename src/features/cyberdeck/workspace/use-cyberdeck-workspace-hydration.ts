"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { toast } from "sonner";
import { loadWorkspaceState } from "@/lib/workspace-state";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { playDeckSystemSound } from "@/features/cyberdeck/runtime/defer-deck-audio";
import {
  notifySurveyTabsCleared,
} from "@/features/cyberdeck/survey/survey-tab-lifecycle";
import {
  isFixedServerTabId,
  sanitizeCustomTabs,
  safeServerId,
  SERVER_IDS,
  type CustomTab,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import {
  UI_STATE_STORAGE_KEY,
  type CyberdeckUiState,
} from "@/features/cyberdeck/workspace/cyberdeck-ui-state";
import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";

export type { CyberdeckUiState };
export { UI_STATE_STORAGE_KEY };

export type UseCyberdeckWorkspaceHydrationOptions = {
  restoreOperatorUiFromDeck: (ui: {
    operatorSurfaceMode?: "workspace" | "browser";
    operatorBrowserUrl?: string;
  }) => void;
  getOperatorSurfaceMode: () => "workspace" | "browser";
  getOperatorBrowserUrl: () => string;
  navRailContext: "gateway" | "tabs";
  setNavRailContext: (context: "gateway" | "tabs") => void;
  serverKeyboardHighlightId: (typeof SERVER_IDS)[number] | null;
  setServerKeyboardHighlightId: (id: (typeof SERVER_IDS)[number] | null) => void;
  providerConfigHydrated: boolean;
  gatewayColumnRef: RefObject<HTMLDivElement | null>;
  serverRailRef: RefObject<HTMLElement | null>;
  startupRailResolvedRef: MutableRefObject<boolean>;
  setMessages: (updater: (prev: MuthurChatMessage[]) => MuthurChatMessage[]) => void;
};

export function useCyberdeckWorkspaceHydration({
  restoreOperatorUiFromDeck,
  getOperatorSurfaceMode,
  getOperatorBrowserUrl,
  navRailContext,
  setNavRailContext,
  serverKeyboardHighlightId,
  setServerKeyboardHighlightId,
  providerConfigHydrated,
  gatewayColumnRef,
  serverRailRef,
  startupRailResolvedRef,
  setMessages,
}: UseCyberdeckWorkspaceHydrationOptions) {
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [deckUiHydrated, setDeckUiHydrated] = useState(false);
  const uiFocusRestoredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored = false;
    try {
      const workspaceState = loadWorkspaceState();
      if (workspaceState) {
        const restoredWorkspaceTabs = sanitizeCustomTabs(workspaceState.customTabs);
        useCyberdeckTabStore.getState().setCustomTabs(restoredWorkspaceTabs);
        if (
          typeof workspaceState.activeCustomTabId === "string" &&
          restoredWorkspaceTabs.some((tab) => tab.id === workspaceState.activeCustomTabId)
        ) {
          useCyberdeckTabStore.getState().setActiveCustomTabId(workspaceState.activeCustomTabId);
          restored = true;
        } else if (
          typeof workspaceState.activeModuleId === "string" &&
          isFixedServerTabId(workspaceState.activeModuleId)
        ) {
          useCyberdeckTabStore.getState().setServer(workspaceState.activeModuleId);
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
          restored = true;
        } else {
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
        }
      }
      const stored = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CyberdeckUiState> | null;
        const allFixedIds = ["m", "s", "ct", "b"] as const;
        const savedServer = parsed?.server;
        if (savedServer && allFixedIds.includes(savedServer as (typeof allFixedIds)[number])) {
          useCyberdeckTabStore.getState().setServer(safeServerId(savedServer) as (typeof SERVER_IDS)[number]);
          restored = true;
        }
        if (parsed?.navRailContext === "gateway" || parsed?.navRailContext === "tabs") {
          setNavRailContext(parsed.navRailContext);
          restored = true;
        }
        const highlightId = parsed?.serverKeyboardHighlightId;
        if (highlightId && allFixedIds.includes(highlightId as (typeof allFixedIds)[number])) {
          setServerKeyboardHighlightId(safeServerId(highlightId) as (typeof SERVER_IDS)[number] | null);
          restored = true;
        }
        if (
          parsed?.operatorSurfaceMode === "workspace" ||
          parsed?.operatorSurfaceMode === "browser" ||
          (typeof parsed?.operatorBrowserUrl === "string" && parsed.operatorBrowserUrl.trim())
        ) {
          restoreOperatorUiFromDeck({
            operatorSurfaceMode: parsed?.operatorSurfaceMode,
            operatorBrowserUrl: parsed?.operatorBrowserUrl,
          });
          restored = true;
        }
        const restoredCustomTabs = sanitizeCustomTabs(parsed?.customTabs);
        useCyberdeckTabStore.getState().setCustomTabs(restoredCustomTabs);
        if (
          typeof parsed?.activeCustomTabId === "string" &&
          restoredCustomTabs.some((tab) => tab.id === parsed.activeCustomTabId)
        ) {
          useCyberdeckTabStore.getState().setActiveCustomTabId(parsed.activeCustomTabId);
        } else {
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
        }
        if (restoredCustomTabs.length > 0) {
          restored = true;
        }
      }
    } catch {
      /* ignore ui restore errors */
    } finally {
      if (restored) {
        startupRailResolvedRef.current = true;
      }
      setWorkspaceHydrated(true);
      setDeckUiHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!deckUiHydrated) return;
    if (isEchoMirageDesktopShell()) {
      useCyberdeckTabStore.getState().setCustomTabs((prev) =>
        prev.filter((tab) => tab.kind !== "install"),
      );
      return;
    }
    useCyberdeckTabStore.getState().setCustomTabs((prev) => {
      if (prev.some((tab) => tab.kind === "install")) return prev;
      return [
        {
          id: "echo-install-pane",
          label: "INSTALL",
          glyph: "I",
          kind: "install",
        },
        ...prev,
      ];
    });
  }, [deckUiHydrated]);

  const buildCyberdeckUiPayload = useCallback(
    (): CyberdeckUiState => {
      const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
      return {
        server,
        navRailContext,
        serverKeyboardHighlightId,
        operatorSurfaceMode: getOperatorSurfaceMode(),
        operatorBrowserUrl: getOperatorBrowserUrl(),
        customTabs: customTabs as CustomTab[],
        activeCustomTabId,
      };
    },
    [getOperatorBrowserUrl, getOperatorSurfaceMode, navRailContext, serverKeyboardHighlightId],
  );

  useEffect(() => {
    if (!deckUiHydrated || uiFocusRestoredRef.current) return;
    if (ENABLE_AUTOMATION && !providerConfigHydrated) return;
    if (ENABLE_AUTOMATION && !startupRailResolvedRef.current) return;
    const id = window.requestAnimationFrame(() => {
      if (navRailContext === "tabs") {
        serverRailRef.current?.focus({ preventScroll: true });
      } else {
        gatewayColumnRef.current?.focus({ preventScroll: true });
      }
      uiFocusRestoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(id);
  }, [deckUiHydrated, gatewayColumnRef, navRailContext, providerConfigHydrated, serverRailRef, startupRailResolvedRef]);

  const clearSavedCustomTabState = useCallback(() => {
    const tabs = useCyberdeckTabStore.getState().customTabs;
    const removedCount = tabs.length;
    notifySurveyTabsCleared(tabs);
    useCyberdeckTabStore.getState().setCustomTabs([]);
    useCyberdeckTabStore.setState({ mountedCustomTabIds: [] });
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);

    try {
      const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CyberdeckUiState> | null;
      if (!parsed || typeof parsed !== "object") return;
      const nextState = { ...parsed };
      delete nextState.customTabs;
      delete nextState.activeCustomTabId;
      window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      /* ignore */
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        text:
          removedCount > 0
            ? `TAB_STATE_CLEARED // REMOVED ${removedCount} CUSTOM TAB${removedCount === 1 ? "" : "S"}`
            : "TAB_STATE_CLEARED // NO_CUSTOM_TABS_FOUND",
      },
    ]);
    playDeckSystemSound("chirp", 0.05);
    if (removedCount > 0) {
      toast.success(`Cleared ${removedCount} custom tab${removedCount === 1 ? "" : "s"}.`);
    } else {
      toast.info("No custom tabs were saved.");
    }
  }, [setMessages]);

  return {
    workspaceHydrated,
    deckUiHydrated,
    buildCyberdeckUiPayload,
    clearSavedCustomTabState,
  };
}
