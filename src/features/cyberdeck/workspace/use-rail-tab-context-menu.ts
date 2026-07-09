"use client";

import type { MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { OPERATOR_BROWSER_HOME_URL } from "@/lib/browser-intents";
import { playDeckSystemSound } from "@/features/cyberdeck/runtime/defer-deck-audio";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import {
  getCyberdeckSelectedRailTabId,
  useCyberdeckTabStore,
} from "@/lib/cyberdeck-tab-store";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import {
  defaultCustomTabGlyphForKind,
  defaultCustomTabLabelForKind,
  isFixedServerTabId,
  isUnassignedCustomTab,
  SERVER_IDS,
  type CustomTab,
  type CustomTabContextMenuAction,
  type CustomTabKind,
} from "@/features/cyberdeck/workspace/custom-tab-model";

export type RailTabContextMenuState =
  | { variant: "custom"; tabId: string; x: number; y: number }
  | { variant: "fixed"; serverId: (typeof SERVER_IDS)[number]; x: number; y: number }
  | { variant: "new"; x: number; y: number }
  | null;

export type UseRailTabContextMenuOptions = {
  closeMirageContextMenu: () => void;
  closeGatewayPaneContextMenu: () => void;
  convertCustomTab: (
    tabId: string,
    nextKind: CustomTabKind,
    options?: { label?: string; glyph?: string },
  ) => void;
  openRealmorphismKitTab: (tabId?: string) => void;
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
};

export function useRailTabContextMenu({
  closeMirageContextMenu,
  closeGatewayPaneContextMenu,
  convertCustomTab,
  openRealmorphismKitTab,
  setNavRailContext,
  setMessages,
}: UseRailTabContextMenuOptions) {
  const [railTabContextMenu, setRailTabContextMenu] = useState<RailTabContextMenuState>(null);

  const closeRailTabContextMenu = useCallback(() => {
    setRailTabContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "rail_tab_menu" }, severity: "info" });
  }, []);

  const openRailTabContextMenu = useCallback(
    (tabId: string, clientX: number, clientY: number) => {
      if (getCyberdeckSelectedRailTabId() !== tabId || typeof window === "undefined") return;
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();

      const menuWidth = 140;
      const tab =
        !isFixedServerTabId(tabId)
          ? useCyberdeckTabStore.getState().customTabs.find((entry) => entry.id === tabId)
          : null;
      const menuHeight = isFixedServerTabId(tabId)
        ? 132
        : isUnassignedCustomTab(tab)
          ? 520
          : 56;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));

      setRailTabContextMenu(
        isFixedServerTabId(tabId)
          ? { variant: "fixed", serverId: tabId, x, y }
          : { variant: "custom", tabId, x, y },
      );
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu],
  );

  const openNewTabMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (typeof window === "undefined") return;
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();

      const menuWidth = 140;
      const menuHeight = 520;
      const padding = 8;
      const x = Math.min(event.clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(event.clientY, Math.max(padding, window.innerHeight - menuHeight - padding));

      setRailTabContextMenu({ variant: "new", x, y });
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu],
  );

  const applyTabMenuAction = useCallback(
    (action: CustomTabContextMenuAction, existingTabId?: string) => {
      closeRailTabContextMenu();
      if (action.action === "kit-pane") {
        openRealmorphismKitTab();
        return;
      }

      const kind: CustomTabKind =
        action.action === "convert" ? action.kind : "settings";

      if (existingTabId) {
        const tab = useCyberdeckTabStore.getState().customTabs.find((entry) => entry.id === existingTabId);
        if (!isUnassignedCustomTab(tab)) return;
        convertCustomTab(existingTabId, kind);
        return;
      }

      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: defaultCustomTabLabelForKind(kind),
        glyph: defaultCustomTabGlyphForKind(kind),
        kind,
        browserUrl: kind === "web" ? OPERATOR_BROWSER_HOME_URL : undefined,
        asset: null,
      };

      flushSync(() => {
        const store = useCyberdeckTabStore.getState();
        store.setCustomTabs((prev) => [...prev, tab]);
        store.setActiveCustomTabId(id);
        store.mountCustomTab(id);
      });
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `TAB_CREATED // ${tab.label} // ${kind.toUpperCase()}` },
      ]);
      playDeckSystemSound("chirp", 0.05);
    },
    [closeRailTabContextMenu, convertCustomTab, openRealmorphismKitTab, setMessages, setNavRailContext],
  );

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "custom") return;
    return useCyberdeckTabStore.subscribe((state) => {
      if (state.activeCustomTabId !== railTabContextMenu.tabId) {
        closeRailTabContextMenu();
      }
    });
  }, [closeRailTabContextMenu, railTabContextMenu]);

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "fixed") return;
    return useCyberdeckTabStore.subscribe((state) => {
      const selected = state.activeCustomTabId ?? state.server;
      if (railTabContextMenu.serverId !== selected) {
        closeRailTabContextMenu();
      }
    });
  }, [closeRailTabContextMenu, railTabContextMenu]);

  return {
    railTabContextMenu,
    closeRailTabContextMenu,
    openRailTabContextMenu,
    openNewTabMenu,
    applyTabMenuAction,
  };
}
