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

/** E / M / P rail — vertical on wide screens, horizontal on mobile (matches main server rail). */
export function SurveySubRail({ active, onSelect }: SurveySubRailProps) {
  return (
    <CyberdeckRailTooltipProvider>
      <nav
        className="survey-emp-rail spy-sub-rail cyberdeck-server-rail relative z-30 flex w-12 min-h-0 flex-shrink-0 flex-col items-center overflow-x-hidden overflow-y-hidden border-r border-[#1c1c1c] bg-black/90 py-4 outline-none max-[768px]:sticky max-[768px]:top-0 max-[768px]:z-30 max-[768px]:w-full max-[768px]:max-w-[100vw] max-[768px]:shrink-0 max-[768px]:flex-row max-[768px]:flex-nowrap max-[768px]:items-center max-[768px]:justify-start max-[768px]:overflow-x-auto max-[768px]:overflow-y-hidden max-[768px]:overscroll-x-contain max-[768px]:border-b max-[768px]:border-r-0 max-[768px]:px-2 max-[768px]:pb-2 max-[768px]:pt-[max(0.5rem,env(safe-area-inset-top))] max-[768px]:[-webkit-overflow-scrolling:touch] max-[768px]:touch-pan-x"
        aria-label="Survey sub-panes"
      >
        <div className="survey-emp-rail-tabs flex w-full flex-col items-center max-[768px]:w-auto max-[768px]:flex-row max-[768px]:items-end max-[768px]:gap-1">
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
