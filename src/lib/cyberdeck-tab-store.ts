"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const CYBERDECK_SERVER_IDS = ["m", "s", "p", "b", "ct"] as const;
export type CyberdeckServerId = (typeof CYBERDECK_SERVER_IDS)[number];

export type CyberdeckCustomTab = {
  id: string;
  label: string;
  glyph: string;
  kind: string;
  browserUrl?: string;
  asset?: {
    kind: string;
    name: string;
    mimeType: string;
    size: number;
    text?: string;
    imageSrc?: string;
  } | null;
};

type CyberdeckTabStore = {
  server: CyberdeckServerId;
  activeCustomTabId: string | null;
  customTabs: CyberdeckCustomTab[];
  mountedFixedServers: string[];
  mountedCustomTabIds: string[];
  setServer: (server: CyberdeckServerId) => void;
  setActiveCustomTabId: (id: string | null) => void;
  setCustomTabs: (
    tabs: CyberdeckCustomTab[] | ((prev: CyberdeckCustomTab[]) => CyberdeckCustomTab[]),
  ) => void;
  mountFixedServer: (id: string) => void;
  mountCustomTab: (id: string) => void;
  selectTab: (id: string, isCustomTab: boolean) => void;
};

function mountId(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

export const useCyberdeckTabStore = create<CyberdeckTabStore>((set, get) => ({
  server: "m",
  activeCustomTabId: null,
  customTabs: [],
  mountedFixedServers: ["m"],
  mountedCustomTabIds: [],

  setServer: (server) => {
    set((state) => ({
      server,
      mountedFixedServers: mountId(state.mountedFixedServers, server),
    }));
  },

  setActiveCustomTabId: (activeCustomTabId) => {
    set((state) => ({
      activeCustomTabId,
      mountedCustomTabIds:
        activeCustomTabId != null
          ? mountId(state.mountedCustomTabIds, activeCustomTabId)
          : state.mountedCustomTabIds,
    }));
  },

  setCustomTabs: (tabs) => {
    set((state) => ({
      customTabs: typeof tabs === "function" ? tabs(state.customTabs) : tabs,
    }));
  },

  mountFixedServer: (id) => {
    set((state) => ({
      mountedFixedServers: mountId(state.mountedFixedServers, id),
    }));
  },

  mountCustomTab: (id) => {
    set((state) => ({
      mountedCustomTabIds: mountId(state.mountedCustomTabIds, id),
    }));
  },

  selectTab: (id, isCustomTab) => {
    if (isCustomTab) {
      const { activeCustomTabId: current } = get();
      if (current === id) return;
      set((state) => ({
        activeCustomTabId: id,
        mountedCustomTabIds: mountId(state.mountedCustomTabIds, id),
      }));
      return;
    }

    const { server: current, activeCustomTabId } = get();
    set((state) => ({
      activeCustomTabId: null,
      server: id as CyberdeckServerId,
      mountedFixedServers: mountId(state.mountedFixedServers, id),
    }));
    if (current === id && activeCustomTabId == null) return;
  },
}));

export function getCyberdeckSelectedRailTabId(): string {
  const { activeCustomTabId, server } = useCyberdeckTabStore.getState();
  return activeCustomTabId ?? server;
}

/** Rail + mirage pane: subscribe without re-rendering the 7k-line page shell. */
export function useCyberdeckTabRailState() {
  return useCyberdeckTabStore(
    useShallow((state) => {
      const activeCustomTab = state.customTabs.find((tab) => tab.id === state.activeCustomTabId) ?? null;
      return {
        server: state.server,
        activeCustomTabId: state.activeCustomTabId,
        customTabs: state.customTabs,
        selectedRailTabId: state.activeCustomTabId ?? state.server,
        activeCustomTab,
        showGatewayPanel: state.server === "s",
        mountedCustomTabs: state.customTabs.filter((tab) =>
          state.mountedCustomTabIds.includes(tab.id),
        ),
        mountedFixedServers: state.mountedFixedServers,
      };
    }),
  );
}
