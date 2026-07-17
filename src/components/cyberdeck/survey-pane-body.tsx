"use client";

import { useEffect, useState } from "react";
import { SurveyHubPanel } from "@/components/cyberdeck/survey-hub-panel";
import { SurveySubRail } from "@/components/cyberdeck/survey-sub-rail";
import { SurveyLegacyNotice } from "@/components/cyberdeck/survey-legacy-notice";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import {
  SURVEY_EMP_SUBPANE_EVENT,
  parseSurveyEmpSubPaneFromLocation,
} from "@/lib/cyberdeck/survey-emp-launch.client";
import { SurveyDesktopInstallPanel } from "@/components/cyberdeck/survey-desktop-install-panel";
import { SurveyEchoPane } from "@/components/cyberdeck/survey-echo-pane";
import { SurveyMiragePane } from "@/components/cyberdeck/survey-mirage-pane";
import { SurveyPowerfistPane } from "@/components/cyberdeck/survey-powerfist-pane";
import { SurveyTeamStatusPanel } from "@/components/cyberdeck/survey-team-status-panel";
import { SurveyHubMiragePowerfistAutoRestore } from "@/components/cyberdeck/survey-hub-mirage-powerfist-auto-restore";
import { isSurveyPowerfistDeckReady } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import type { SurveySubPane } from "@/lib/cyberdeck/survey-mode";

export function CyberdeckSurveyPaneBody() {
  const [activeSubPane, setActiveSubPane] = useState<SurveySubPane>(() => {
    if (typeof window === "undefined") return "mirage";
    return parseSurveyEmpSubPaneFromLocation() ?? "mirage";
  });
  const team = useSurveyTeamStatus();
  const powerfistDeckMode =
    activeSubPane === "powerfist" && isSurveyPowerfistDeckReady(team);
  /** Mirage tab stays capture + answers; Hub/TEAM LINKS live on Echo / PowerFist. */
  const showSurveyHubChrome = activeSubPane !== "mirage" && !powerfistDeckMode;

  useEffect(() => {
    const fromUrl = parseSurveyEmpSubPaneFromLocation();
    if (fromUrl) setActiveSubPane(fromUrl);

    const onSubPane = (event: Event) => {
      const subPane = (event as CustomEvent<{ subPane: SurveySubPane }>).detail?.subPane;
      if (subPane) setActiveSubPane(subPane);
    };
    window.addEventListener(SURVEY_EMP_SUBPANE_EVENT, onSubPane);
    return () => window.removeEventListener(SURVEY_EMP_SUBPANE_EVENT, onSubPane);
  }, []);

  return (
    <div className="cyberdeck-survey-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black min-[769px]:flex-row">
      <SurveyHubMiragePowerfistAutoRestore />
      <SurveySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      <div
        className={
          powerfistDeckMode
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
        }
      >
        {showSurveyHubChrome ? (
          <>
            {isSurveyHubEnabled() ? <SurveyHubPanel /> : <SurveyLegacyNotice />}
            <SurveyTeamStatusPanel />
          </>
        ) : null}
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
