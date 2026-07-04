"use client";

import { useState } from "react";
import { SurveyHubPanel } from "@/components/cyberdeck/survey-hub-panel";
import { SurveySubRail } from "@/components/cyberdeck/survey-sub-rail";
import { SurveyLegacyNotice } from "@/components/cyberdeck/survey-legacy-notice";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { SurveyDesktopInstallPanel } from "@/components/cyberdeck/survey-desktop-install-panel";
import { SurveyEchoPane } from "@/components/cyberdeck/survey-echo-pane";
import { SurveyMiragePane } from "@/components/cyberdeck/survey-mirage-pane";
import { SurveyMiragePairingDock } from "@/components/cyberdeck/survey-mirage-pairing-dock";
import { SurveyPowerfistPane } from "@/components/cyberdeck/survey-powerfist-pane";
import { SurveyTeamStatusPanel } from "@/components/cyberdeck/survey-team-status-panel";
import { isSurveyTeamTripleLinked } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import type { SurveySubPane } from "@/lib/cyberdeck/survey-mode";

export function CyberdeckSurveyPaneBody() {
  const [activeSubPane, setActiveSubPane] = useState<SurveySubPane>("mirage");
  const team = useSurveyTeamStatus();
  const powerfistDeckMode =
    activeSubPane === "powerfist" && isSurveyTeamTripleLinked(team);

  return (
    <div className="cyberdeck-survey-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black min-[769px]:flex-row">
      <SurveySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      <div
        className={
          powerfistDeckMode
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
        }
      >
        {!powerfistDeckMode ? (
          <>
            {isSurveyHubEnabled() ? <SurveyHubPanel /> : <SurveyLegacyNotice />}
            {!isSurveyHubEnabled() ? <SurveyMiragePairingDock /> : null}
          </>
        ) : null}
        {powerfistDeckMode ? null : (
          <SurveyTeamStatusPanel />
        )}
        {activeSubPane === "echo" ? <SurveyEchoPane /> : null}
        {activeSubPane === "mirage" ? <SurveyMiragePane /> : null}
        {activeSubPane === "powerfist" ? (
          <div className={powerfistDeckMode ? "flex min-h-0 min-w-0 flex-1 flex-col" : undefined}>
            <SurveyPowerfistPane key="survey-powerfist-active" />
          </div>
        ) : null}
        {activeSubPane !== "mirage" && !powerfistDeckMode ? (
          <SurveyDesktopInstallPanel activeSubPane={activeSubPane} />
        ) : null}
      </div>
    </div>
  );
}
