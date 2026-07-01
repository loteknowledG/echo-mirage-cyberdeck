"use client";

import { useState } from "react";
import { SurveySubRail } from "@/components/cyberdeck/survey-sub-rail";
import { SurveyDesktopInstallPanel } from "@/components/cyberdeck/survey-desktop-install-panel";
import { SurveyEchoPane } from "@/components/cyberdeck/survey-echo-pane";
import { SurveyMiragePane } from "@/components/cyberdeck/survey-mirage-pane";
import { SurveyPowerfistPane } from "@/components/cyberdeck/survey-powerfist-pane";
import { SurveyTeamStatusPanel } from "@/components/cyberdeck/survey-team-status-panel";
import type { SurveySubPane } from "@/lib/cyberdeck/survey-mode";

export function CyberdeckSurveyPaneBody() {
  const [activeSubPane, setActiveSubPane] = useState<SurveySubPane>("mirage");

  return (
    <div className="cyberdeck-spy-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black">
      <SurveySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      <SurveyTeamStatusPanel />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activeSubPane === "echo" ? <SurveyEchoPane /> : null}
        {activeSubPane === "mirage" ? <SurveyMiragePane /> : null}
        {activeSubPane === "powerfist" ? <SurveyPowerfistPane /> : null}
      </div>
      {activeSubPane !== "mirage" ? <SurveyDesktopInstallPanel activeSubPane={activeSubPane} /> : null}
    </div>
  );
}
