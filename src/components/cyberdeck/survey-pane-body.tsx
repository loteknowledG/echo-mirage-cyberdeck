"use client";

import { useState } from "react";
import { SurveySubRail } from "@/components/cyberdeck/survey-sub-rail";
import { SurveyLegacyNotice } from "@/components/cyberdeck/survey-legacy-notice";
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
    <div className="cyberdeck-spy-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black">
      <div className="relative z-30 shrink-0 bg-black">
        <SurveySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      </div>
      <div
        className={
          powerfistDeckMode
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        }
      >
        {!powerfistDeckMode ? (
          <>
            <SurveyLegacyNotice />
            <SurveyMiragePairingDock />
          </>
        ) : null}
        {powerfistDeckMode ? (
          <div className="shrink-0 border-b border-[#1a1a1a] bg-[#080808] px-4 py-1.5 font-mono text-[8px] tracking-[0.06em] text-emerald-300/85">
            TEAM LINKS // all green
            {team.echoHost ? (
              <>
                {" "}
                · ECHO @ <span className="text-emerald-200/90">{team.echoHost}</span>
              </>
            ) : null}
          </div>
        ) : (
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
