"use client";

import { RailAsciiButton } from "@/components/cyberdeck/rail-ascii-button";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_POWERFIST_LABEL,
} from "@/lib/cyberdeck/espionage-mode";
import type { SpySubPane } from "@/lib/cyberdeck/spy-context";
import {
  CyberdeckRailTooltipProvider,
  CyberdeckRailTabTooltip,
} from "@/components/cyberdeck/cyberdeck-rail-tooltip";

const SUB_PANES: Array<{ id: SpySubPane; glyph: string; label: string }> = [
  { id: "echo", glyph: "e", label: ESPIONAGE_ECHO_DISPLAY },
  { id: "mirage", glyph: "m", label: ESPIONAGE_MIRAGE_DISPLAY },
  { id: "powerfist", glyph: "p", label: ESPIONAGE_POWERFIST_LABEL },
];

type SpySubRailProps = {
  active: SpySubPane;
  onSelect: (pane: SpySubPane) => void;
};

export function SpySubRail({ active, onSelect }: SpySubRailProps) {
  return (
    <CyberdeckRailTooltipProvider>
      <nav
        className="spy-sub-rail cyberdeck-server-rail flex shrink-0 flex-row items-end gap-1 border-b border-[#1c1c1c] bg-black/90 px-3 py-2"
        aria-label="Espionage sub-panes"
      >
        {SUB_PANES.map((pane) => (
          <CyberdeckRailTabTooltip key={pane.id} label={pane.label}>
            <div className="cyberdeck-rail-tab">
              <RailAsciiButton
                glyph={pane.glyph}
                isPushed={active === pane.id}
                className={`ascii-btn${active === pane.id ? " is-pushed" : ""}`}
                onClick={() => onSelect(pane.id)}
              />
            </div>
          </CyberdeckRailTabTooltip>
        ))}
      </nav>
    </CyberdeckRailTooltipProvider>
  );
}
