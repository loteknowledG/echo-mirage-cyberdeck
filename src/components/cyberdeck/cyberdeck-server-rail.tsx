"use client";

import { useEffect, type MouseEvent, type RefObject } from "react";
import { art } from "@/lib/TerminalArt";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { CyberdeckServerId } from "@/lib/cyberdeck-tab-store";

type FixedServerBtn = { id: string; glyph: string; label: string };

type CyberdeckServerRailProps = {
  railRef: RefObject<HTMLElement | null>;
  fixedServers: FixedServerBtn[];
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: CyberdeckServerId | null;
  railGlyphForServer: (btn: FixedServerBtn) => string;
  railGlyphForCustomTab: (tab: { kind: string; glyph: string; id?: string; label?: string }) => string;
  onTabClick: (id: string) => void;
  onCreateBlankTab: () => void;
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
  onCreateBlankTab,
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
      if (!tabEl || !rail) return;

      const railRect = rail.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      const vertical = railRect.height >= railRect.width;
      const inView = vertical
        ? tabRect.top >= railRect.top - 1 && tabRect.bottom <= railRect.bottom + 1
        : tabRect.left >= railRect.left - 1 && tabRect.right <= railRect.right + 1;

      if (!inView) {
        tabEl.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
    });
  }, [railRef, selectedRailTabId]);

  return (
    <aside
      ref={railRef as RefObject<HTMLElement>}
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      tabIndex={-1}
      aria-label="Server rail"
      className="cyberdeck-server-rail z-40 flex w-12 flex-shrink-0 flex-col items-center border-r border-gray-800 bg-black py-4 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 md:min-h-0 md:overflow-y-auto md:overscroll-y-contain max-md:sticky max-md:top-[max(0px,env(safe-area-inset-top))] max-md:self-start max-md:bg-black/95 max-md:backdrop-blur-sm max-md:h-auto max-md:w-full max-md:flex-row max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:snap-x max-md:snap-mandatory max-md:border-b max-md:border-r-0 max-md:px-2 max-md:py-2 max-md:touch-pan-x"
    >
      {fixedServers.map((btn) => (
        <cyberdeck-rail-tab
          key={btn.id}
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
              position: "absolute",
              inset: 0,
              margin: 0,
              cursor: "pointer",
            }}
          >
            {selectedRailTabId === btn.id
              ? art.pushed(railGlyphForServer(btn))
              : art.popped(railGlyphForServer(btn))}
          </pre>
        </cyberdeck-rail-tab>
      ))}
      {customTabs.map((tab) => (
        <cyberdeck-rail-tab
          key={tab.id}
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
              position: "absolute",
              inset: 0,
              margin: 0,
              cursor: "pointer",
            }}
          >
            {selectedRailTabId === tab.id
              ? art.pushed(railGlyphForCustomTab(tab))
              : art.popped(railGlyphForCustomTab(tab))}
          </pre>
        </cyberdeck-rail-tab>
      ))}
      <div className="flex w-12 shrink-0 flex-col gap-2 px-2 max-md:mt-0 max-md:snap-start md:mt-2">
        <button
          type="button"
          onClick={onCreateBlankTab}
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] leading-none tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
        >
          +
        </button>
      </div>
    </aside>
  );
}
