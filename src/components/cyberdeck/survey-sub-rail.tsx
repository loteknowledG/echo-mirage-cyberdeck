"use client";

import { RailAsciiButton } from "@/components/cyberdeck/rail-ascii-button";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";
import type { SurveySubPane } from "@/lib/cyberdeck/survey-mode";
import {
  CyberdeckRailTooltipProvider,
  CyberdeckRailTabTooltip,
} from "@/components/cyberdeck/cyberdeck-rail-tooltip";
import { SurveyShellBadge } from "@/components/cyberdeck/survey-shell-badge";

const SUB_PANES: Array<{ id: SurveySubPane; glyph: string; label: string }> = [
  { id: "echo", glyph: "e", label: SURVEY_ECHO_DISPLAY },
  { id: "mirage", glyph: "m", label: SURVEY_MIRAGE_DISPLAY },
  { id: "powerfist", glyph: "p", label: "POWERFIST (phone)" },
];

type SurveySubRailProps = {
  active: SurveySubPane;
  onSelect: (pane: SurveySubPane) => void;
};

export function SurveySubRail({ active, onSelect }: SurveySubRailProps) {
  return (
    <CyberdeckRailTooltipProvider>
      <nav
        className="spy-sub-rail cyberdeck-server-rail flex shrink-0 flex-row items-end gap-1 border-b border-[#1c1c1c] bg-black/90 px-3 py-2"
        aria-label="Survey sub-panes"
      >
        <div className="flex flex-row items-end gap-1">
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
        </div>
        <SurveyShellBadge />
      </nav>
    </CyberdeckRailTooltipProvider>
  );
}
