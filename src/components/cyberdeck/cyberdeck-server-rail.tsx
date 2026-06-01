"use client";

import { useEffect, type MouseEvent, type RefObject } from "react";
import { art } from "@/lib/TerminalArt";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import {
  railPaneLabelForCustomTab,
  railPaneLabelForFixedServer,
} from "@/lib/cyberdeck/rail-pane-label";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import {
  CyberdeckRailTabTooltip,
  CyberdeckRailTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-rail-tooltip";

type FixedServerBtn = { id: string; glyph: string; label: string };

type CyberdeckServerRailProps = {
  railRef: RefObject<HTMLElement | null>;
  fixedServers: FixedServerBtn[];
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: CyberdeckServerId | null;
  railGlyphForServer: (btn: FixedServerBtn) => string;
  railGlyphForCustomTab: (tab: { kind: string; glyph: string; id?: string; label?: string }) => string;
  onTabClick: (id: string) => void;
  onOpenNewTabMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onRailContextMenu: (tabId: string, event: MouseEvent<HTMLElement>) => void;
  createRailTabLongPressHandlers: (tabId: string) => Record<string, unknown>;
  consumeClickIfLongPress: (tabId: string) => boolean;
  onPointerNavReset: () => void;
};

/** Isolated rail — tab store updates do not re-render the main cyberdeck page shell. */
export function CyberdeckServerRail({
  railRef,
  fixedServers,
  navRailContext,
  serverKeyboardHighlightId,
  railGlyphForServer,
  railGlyphForCustomTab,
  onTabClick,
  onOpenNewTabMenu,
  onRailContextMenu,
  createRailTabLongPressHandlers,
  consumeClickIfLongPress,
  onPointerNavReset,
}: CyberdeckServerRailProps) {
  const selectedRailTabId = useCyberdeckTabStore((s) => s.activeCustomTabId ?? s.server);
  const customTabs = useCyberdeckTabStore((s) => s.customTabs);

  useEffect(() => {
    const selectedRailTabId = useCyberdeckTabStore.getState().activeCustomTabId
      ?? useCyberdeckTabStore.getState().server;
    window.requestAnimationFrame(() => {
      const rail = railRef.current;
      const tabEl = rail?.querySelector<HTMLElement>(`[data-server-tab="${selectedRailTabId}"]`);
      const scrollTarget =
        tabEl?.closest<HTMLElement>("[data-rail-tab-cell]") ?? tabEl?.parentElement ?? tabEl;
      if (!scrollTarget || !rail) return;

      const railRect = rail.getBoundingClientRect();
      const tabRect = scrollTarget.getBoundingClientRect();
      const horizontal = railRect.width >= railRect.height;
      const inView = horizontal
        ? tabRect.left >= railRect.left - 1 && tabRect.right <= railRect.right + 1
        : tabRect.top >= railRect.top - 1 && tabRect.bottom <= railRect.bottom + 1;

      if (!inView) {
        scrollTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    });
  }, [railRef, selectedRailTabId, customTabs.length, fixedServers.length]);

  return (
    <CyberdeckRailTooltipProvider>
    <aside
      ref={railRef as RefObject<HTMLElement>}
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      tabIndex={-1}
      aria-label="Server rail"
      className="cyberdeck-server-rail z-50 flex w-12 flex-shrink-0 flex-col items-center border-r border-gray-800 bg-black py-4 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 md:min-h-0 md:overflow-y-auto md:overscroll-y-contain max-md:sticky max-md:top-0 max-md:w-full max-md:max-w-[100vw] max-md:shrink-0 max-md:flex-row max-md:flex-nowrap max-md:items-center max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:border-b max-md:border-r-0 max-md:bg-black max-md:px-2 max-md:pb-2 max-md:pt-[max(0.5rem,env(safe-area-inset-top))] max-md:[-webkit-overflow-scrolling:touch] max-md:[scroll-padding-inline:8px] max-md:touch-pan-x"
    >
      {fixedServers.map((btn) => (
        <CyberdeckRailTabTooltip
          key={btn.id}
          label={railPaneLabelForFixedServer(btn.id, btn.label)}
        >
        <cyberdeck-rail-tab
          data-server-tab={btn.id}
          onContextMenu={(event) => onRailContextMenu(btn.id, event)}
          {...createRailTabLongPressHandlers(btn.id)}
        >
          <pre
            className={`ascii-btn${selectedRailTabId === btn.id ? " is-pushed" : ""}${
              navRailContext === "tabs" && serverKeyboardHighlightId === btn.id
                ? " server-rail-kb-hover"
                : ""
            }`}
            onClick={() => {
              if (consumeClickIfLongPress(btn.id)) return;
              onPointerNavReset();
              onTabClick(btn.id);
            }}
            style={{
              margin: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          >
            {selectedRailTabId === btn.id
              ? art.pushed(railGlyphForServer(btn))
              : art.popped(railGlyphForServer(btn))}
          </pre>
        </cyberdeck-rail-tab>
        </CyberdeckRailTabTooltip>
      ))}
      {customTabs.map((tab) => (
        <CyberdeckRailTabTooltip key={tab.id} label={railPaneLabelForCustomTab(tab)}>
        <cyberdeck-rail-tab
          data-server-tab={tab.id}
          onContextMenu={(event) => onRailContextMenu(tab.id, event)}
          {...createRailTabLongPressHandlers(tab.id)}
        >
          <pre
            className={`ascii-btn${selectedRailTabId === tab.id ? " is-pushed" : ""}${
              navRailContext === "tabs" && serverKeyboardHighlightId === tab.id
                ? " server-rail-kb-hover"
                : ""
            }`}
            onClick={() => {
              if (consumeClickIfLongPress(tab.id)) return;
              onPointerNavReset();
              onTabClick(tab.id);
            }}
            style={{
              margin: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          >
            {selectedRailTabId === tab.id
              ? art.pushed(railGlyphForCustomTab(tab))
              : art.popped(railGlyphForCustomTab(tab))}
          </pre>
        </cyberdeck-rail-tab>
        </CyberdeckRailTabTooltip>
      ))}
      <div className="flex w-12 shrink-0 flex-col gap-2 px-2 max-md:flex-row max-md:items-center max-md:mt-0 md:mt-2">
        <CyberdeckRailTabTooltip label="NEW TAB">
        <button
          type="button"
          onClick={onOpenNewTabMenu}
          aria-label="Choose new tab type"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] leading-none tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
        >
          +
        </button>
        </CyberdeckRailTabTooltip>
      </div>
    </aside>
    </CyberdeckRailTooltipProvider>
  );
}
