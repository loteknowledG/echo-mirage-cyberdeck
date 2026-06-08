"use client";

import { useEffect, type MouseEvent, type RefObject, type WheelEvent } from "react";
import { motion, useMotionValue, type PanInfo } from "motion/react";
import { RailAsciiButton } from "@/components/cyberdeck/rail-ascii-button";
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
  isMobileLayout: boolean;
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
  isMobileLayout,
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
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const handleRailDrag = (
    _event: globalThis.PointerEvent | globalThis.MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    const rail = railRef.current;
    if (!rail) return;
    if (isMobileLayout) {
      rail.scrollLeft -= info.delta.x;
      dragX.set(0);
      return;
    }
    rail.scrollTop -= info.delta.y;
    dragY.set(0);
  };

  const handleRailWheel = (event: WheelEvent<HTMLElement>) => {
    const rail = railRef.current;
    if (!rail) return;

    if (isMobileLayout) {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta !== 0) {
        rail.scrollLeft += delta;
        event.preventDefault();
      }
      return;
    }

    if (event.deltaY !== 0) {
      rail.scrollTop += event.deltaY;
      event.preventDefault();
    }
  };

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
    <motion.aside
      ref={railRef as RefObject<HTMLElement>}
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      tabIndex={-1}
      aria-label="Server rail"
      drag={isMobileLayout ? "x" : "y"}
      dragDirectionLock
      dragMomentum={false}
      style={isMobileLayout ? { x: dragX } : { y: dragY }}
      onDrag={handleRailDrag}
      onWheel={handleRailWheel}
      className="cyberdeck-server-rail z-50 flex w-12 min-h-0 flex-shrink-0 flex-col items-center overflow-x-hidden overflow-y-hidden border-r border-gray-800 bg-black py-4 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 max-[768px]:sticky max-[768px]:top-0 max-[768px]:w-full max-[768px]:max-w-[100vw] max-[768px]:shrink-0 max-[768px]:flex-row max-[768px]:flex-nowrap max-[768px]:items-center max-[768px]:justify-start max-[768px]:overflow-x-auto max-[768px]:overflow-y-hidden max-[768px]:overscroll-x-contain max-[768px]:border-b max-[768px]:border-r-0 max-[768px]:bg-black max-[768px]:px-2 max-[768px]:pb-2 max-[768px]:pt-[max(0.5rem,env(safe-area-inset-top))] max-[768px]:[-webkit-overflow-scrolling:touch] max-[768px]:[scroll-padding-inline:8px] max-[768px]:touch-pan-x"
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
          <RailAsciiButton
            glyph={railGlyphForServer(btn)}
            isPushed={selectedRailTabId === btn.id}
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
          />
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
          <RailAsciiButton
            glyph={railGlyphForCustomTab(tab)}
            isPushed={selectedRailTabId === tab.id}
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
          />
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
    </motion.aside>
    </CyberdeckRailTooltipProvider>
  );
}
