"use client";

import {
  useCallback,
  useEffect,
  useRef,
  startTransition,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import { OPERATOR_BROWSER_HOME_URL } from "@/lib/browser-intents";
import { playDeckSystemSound } from "@/features/cyberdeck/runtime/defer-deck-audio";
import { emitSignal, type DeckSignal } from "@/lib/cyberdeck/signal-router";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { DroppedOperatorAsset } from "@/features/cyberdeck/muthur/coding-verify-format";
import {
  CustomTabPaneRenderer,
  type CustomTabPaneRendererProps,
} from "@/features/cyberdeck/workspace/custom-tab-pane-renderer";
import {
  defaultCustomTabGlyphForKind,
  defaultCustomTabLabelForKind,
  isUnassignedCustomTab,
  SERVER_IDS,
  type CustomTab,
  type CustomTabKind,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import { useCustomTabBrowser } from "@/features/cyberdeck/workspace/use-custom-tab-browser";
import { useRailTabContextMenu } from "@/features/cyberdeck/workspace/use-rail-tab-context-menu";
import { notifySurveyTabClosed } from "@/features/cyberdeck/survey/survey-tab-lifecycle";

export type CustomTabPaneContext = Omit<
  CustomTabPaneRendererProps,
  "tab" | "customTabBrowserNavigate" | "handleCustomTabDrop"
>;

const MODULE_TAB_KINDS = [
  "memory-atlas",
  "catalog",
  "operators",
  "flight-log",
  "voice-lab",
  "glyph-channel",
  "rola-dex",
  "tunes",
  "settings",
] as const;

export type ModuleTabKind = (typeof MODULE_TAB_KINDS)[number];

export type UseCyberdeckGatewayTabsOptions = {
  assignOperatorAsset: (asset: DroppedOperatorAsset) => void;
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setServerKeyboardHighlightId: (id: (typeof SERVER_IDS)[number] | null) => void;
  closeMirageContextMenu: () => void;
  closeGatewayPaneContextMenu: () => void;
  focusGatewayConnectionPanel: () => void;
  handleTabClickRef: MutableRefObject<
    (
      id: string,
      anchor?: {
        clientX: number;
        clientY: number;
      },
    ) => boolean
  >;
  openRealmorphismKitTabRef: MutableRefObject<(tabId?: string) => void>;
  customTabPane: CustomTabPaneContext;
};

export function useCyberdeckGatewayTabs({
  assignOperatorAsset,
  setNavRailContext,
  setMessages,
  setServerKeyboardHighlightId,
  closeMirageContextMenu,
  closeGatewayPaneContextMenu,
  focusGatewayConnectionPanel,
  handleTabClickRef,
  openRealmorphismKitTabRef,
  customTabPane,
}: UseCyberdeckGatewayTabsOptions) {
  const updateCustomTab = useCallback((tabId: string, updater: (tab: CustomTab) => CustomTab) => {
    useCyberdeckTabStore.getState().setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? updater(tab as CustomTab) : (tab as CustomTab))),
    );
  }, []);

  const convertCustomTab = useCallback(
    (
      tabId: string,
      nextKind: CustomTabKind,
      options?: {
        label?: string;
        glyph?: string;
      },
    ) => {
      const sourceTab = useCyberdeckTabStore.getState().customTabs.find((t) => t.id === tabId);
      if (!sourceTab) return;
      if (!isUnassignedCustomTab(sourceTab)) return;

      if (nextKind === "document") {
        const sourceAsset = sourceTab.asset as DroppedOperatorAsset | null | undefined;
        flushSync(() => {
          if (sourceAsset) {
            assignOperatorAsset(sourceAsset);
          }
          const store = useCyberdeckTabStore.getState();
          store.setActiveCustomTabId(null);
          store.setServer("m");
          store.mountFixedServer("m");
        });
        setNavRailContext("gateway");
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: sourceAsset
              ? `TAB_DOCUMENT // OPENED ØPERATOR // ${sourceAsset.name}`
              : "TAB_DOCUMENT // OPENED ØPERATOR WORKSPACE",
          },
        ]);
        playDeckSystemSound("chirp", 0.05);
        return;
      }

      flushSync(() => {
        updateCustomTab(tabId, (tab) => {
          const nextLabel = options?.label || tab.label || nextKind.toUpperCase();
          const nextGlyph = options?.glyph || tab.glyph || defaultCustomTabGlyphForKind(nextKind);

          return {
            ...tab,
            kind: nextKind,
            label: nextLabel,
            glyph: nextGlyph,
            browserUrl: nextKind === "web" ? tab.browserUrl || OPERATOR_BROWSER_HOME_URL : undefined,
            asset: null,
          };
        });
        const store = useCyberdeckTabStore.getState();
        store.setActiveCustomTabId(tabId);
        store.mountCustomTab(tabId);
      });
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `TAB_CONVERTED // ${tabId} // ${nextKind.toUpperCase()}`,
        },
      ]);
      playDeckSystemSound("chirp", 0.05);
    },
    [assignOperatorAsset, setMessages, setNavRailContext, updateCustomTab],
  );

  const { customTabBrowserNavigate, handleCustomTabDrop } = useCustomTabBrowser({
    updateCustomTab,
    setNavRailContext,
    setMessages,
  });

  const {
    railTabContextMenu,
    closeRailTabContextMenu,
    openRailTabContextMenu,
    openNewTabMenu,
    applyTabMenuAction,
  } = useRailTabContextMenu({
    closeMirageContextMenu,
    closeGatewayPaneContextMenu,
    convertCustomTab,
    openRealmorphismKitTab: (tabId) => openRealmorphismKitTabRef.current(tabId),
    setNavRailContext,
    setMessages,
  });

  const openRealmorphismKitTab = useCallback(
    (tabId?: string) => {
      closeRailTabContextMenu();
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();

      const targetTabId = tabId || `tab-${crypto.randomUUID()}`;

      flushSync(() => {
        const store = useCyberdeckTabStore.getState();
        const existing = store.customTabs.some((tab) => tab.id === targetTabId);

        if (existing) {
          store.setCustomTabs((prev) =>
            prev.map((tab) =>
              tab.id === targetTabId
                ? {
                    ...tab,
                    label: "REALMORPHISM KIT",
                    glyph: "K",
                    kind: "realmorphism-kit",
                    browserUrl: undefined,
                    asset: null,
                  }
                : tab,
            ),
          );
        } else {
          store.setCustomTabs((prev) => [
            ...prev,
            {
              id: targetTabId,
              label: "REALMORPHISM KIT",
              glyph: "K",
              kind: "realmorphism-kit",
              asset: null,
            },
          ]);
        }

        store.setActiveCustomTabId(targetTabId);
        store.mountCustomTab(targetTabId);
      });

      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "TAB_KIT // REALMORPHISM REGISTRY OPENED" },
      ]);
      playDeckSystemSound("chirp", 0.05);
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu, setMessages, setNavRailContext],
  );

  useEffect(() => {
    openRealmorphismKitTabRef.current = openRealmorphismKitTab;
  }, [openRealmorphismKitTab, openRealmorphismKitTabRef]);

  const deleteActiveTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
    if (!activeCustomTabId) return;
    const closingTab = useCyberdeckTabStore
      .getState()
      .customTabs.find((tab) => tab.id === activeCustomTabId);
    useCyberdeckTabStore.getState().setCustomTabs((prev) => prev.filter((tab) => tab.id !== activeCustomTabId));
    useCyberdeckTabStore.setState((state) => ({
      mountedCustomTabIds: state.mountedCustomTabIds.filter((id) => id !== activeCustomTabId),
    }));
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    notifySurveyTabClosed(closingTab?.kind);
    playDeckSystemSound("click", 0.02);
  }, [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu]);

  const handleTabClick = useCallback(
    (
      id: string,
      anchor?: {
        clientX: number;
        clientY: number;
      },
    ): boolean => {
      const { customTabs, activeCustomTabId, server } = useCyberdeckTabStore.getState();
      const isCustomTab = customTabs.some((tab) => tab.id === id);
      const willChange = isCustomTab
        ? activeCustomTabId !== id
        : activeCustomTabId !== null || server !== id;

      flushSync(() => {
        if (willChange) {
          if (isCustomTab) {
            useCyberdeckTabStore.getState().selectTab(id, true);
          } else {
            useCyberdeckTabStore.getState().selectTab(id, false);
          }
        }
      });

      if (willChange) {
        playDeckSystemSound("chirp", 0.03);
        emitSignal({
          source: "ui",
          type: "select",
          payload: { tabId: id, kind: isCustomTab ? "custom" : "fixed" },
          severity: "info",
        });
        startTransition(() => {
          closeRailTabContextMenu();
          closeMirageContextMenu();
          closeGatewayPaneContextMenu();
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
          if (!isCustomTab && id === "s") {
            focusGatewayConnectionPanel();
          }
        });
        return true;
      }

      playDeckSystemSound("click", 0.02);
      startTransition(() => {
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
        setServerKeyboardHighlightId(null);

        const tabEl = document.querySelector<HTMLElement>(`[data-server-tab="${CSS.escape(id)}"]`);
        const rect = tabEl?.getBoundingClientRect();
        const clientX = anchor?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
        const clientY = anchor?.clientY ?? (rect ? rect.bottom : window.innerHeight / 2);
        openRailTabContextMenu(id, clientX, clientY);
      });
      return false;
    },
    [
      closeGatewayPaneContextMenu,
      closeMirageContextMenu,
      closeRailTabContextMenu,
      focusGatewayConnectionPanel,
      openRailTabContextMenu,
      setNavRailContext,
      setServerKeyboardHighlightId,
    ],
  );

  useEffect(() => {
    handleTabClickRef.current = handleTabClick;
  }, [handleTabClick, handleTabClickRef]);

  const openOrFocusDiagnosticsTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "diagnostics");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: "DIAGNOSTICS",
      glyph: defaultCustomTabGlyphForKind("diagnostics"),
      kind: "diagnostics",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, [setNavRailContext]);

  const openOrFocusPiTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "pi");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: defaultCustomTabLabelForKind("pi"),
      glyph: defaultCustomTabGlyphForKind("pi"),
      kind: "pi",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, [setNavRailContext]);

  const openOrFocusCallCenterTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "call-center");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: defaultCustomTabLabelForKind("call-center"),
      glyph: defaultCustomTabGlyphForKind("call-center"),
      kind: "call-center",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, [setNavRailContext]);

  const openOrFocusModuleTab = useCallback(
    (target: ModuleTabKind) => {
      const customTabs = useCyberdeckTabStore.getState().customTabs;
      const existing = customTabs.find((tab) => tab.kind === target);
      if (existing) {
        useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
        setNavRailContext("tabs");
        playDeckSystemSound("chirp", 0.05);
        emitSignal({
          source: "system",
          type: "focused_module",
          payload: { target },
          severity: "info",
        });
        return true;
      }
      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: defaultCustomTabLabelForKind(target),
        glyph: defaultCustomTabGlyphForKind(target),
        kind: target,
      };
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      emitSignal({
        source: "system",
        type: "focused_module",
        payload: { target },
        severity: "info",
      });
      return true;
    },
    [setNavRailContext],
  );

  const handleModuleFocusSignal = useCallback(
    (signal: DeckSignal) => {
      if (signal.source !== "system" || signal.type !== "module_focus_requested") return;
      const target = signal.payload?.["target"];
      if (typeof target !== "string") return;
      if (!(MODULE_TAB_KINDS as readonly string[]).includes(target)) return;
      const focused = openOrFocusModuleTab(target as ModuleTabKind);
      if (focused) return;
      emitSignal({
        source: "system",
        type: "navigate_recommendation",
        payload: { target },
        severity: "info",
      });
    },
    [openOrFocusModuleTab],
  );

  const renderCustomTabSurface = useCallback(
    (tab: CustomTab) => (
      <CustomTabPaneRenderer
        tab={tab}
        {...customTabPane}
        customTabBrowserNavigate={customTabBrowserNavigate}
        handleCustomTabDrop={handleCustomTabDrop}
      />
    ),
    [customTabPane, customTabBrowserNavigate, handleCustomTabDrop],
  );

  return {
    updateCustomTab,
    convertCustomTab,
    customTabBrowserNavigate,
    handleCustomTabDrop,
    railTabContextMenu,
    closeRailTabContextMenu,
    openRailTabContextMenu,
    openNewTabMenu,
    applyTabMenuAction,
    openRealmorphismKitTab,
    deleteActiveTab,
    handleTabClick,
    openOrFocusDiagnosticsTab,
    openOrFocusPiTab,
    openOrFocusCallCenterTab,
    openOrFocusModuleTab,
    handleModuleFocusSignal,
    renderCustomTabSurface,
  };
}
