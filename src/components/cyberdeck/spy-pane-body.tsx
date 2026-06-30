"use client";

import { useState } from "react";
import { SpySubRail } from "@/components/cyberdeck/spy-sub-rail";
import { SpyDesktopInstallPanel } from "@/components/cyberdeck/spy-desktop-install-panel";
import { SpyEchoPane } from "@/components/cyberdeck/spy-echo-pane";
import { SpyMiragePane } from "@/components/cyberdeck/spy-mirage-pane";
import { SpyPowerfistPane } from "@/components/cyberdeck/spy-powerfist-pane";
import { SpyTeamStatusPanel } from "@/components/cyberdeck/spy-team-status-panel";
import type { SpySubPane } from "@/lib/cyberdeck/espionage-mode";

export function CyberdeckSpyPaneBody() {
  const [activeSubPane, setActiveSubPane] = useState<SpySubPane>("mirage");

  return (
    <div className="cyberdeck-spy-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black">
      <SpySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      <SpyTeamStatusPanel />
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSubPane === "echo" ? <SpyEchoPane /> : null}
        {activeSubPane === "mirage" ? <SpyMiragePane /> : null}
        {activeSubPane === "powerfist" ? <SpyPowerfistPane /> : null}
      </div>
      <SpyDesktopInstallPanel activeSubPane={activeSubPane} />
    </div>
  );
}
