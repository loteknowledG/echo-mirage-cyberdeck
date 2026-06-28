"use client";

import { useEffect } from "react";
import { SpySubRail } from "@/components/cyberdeck/spy-sub-rail";
import { SpyEchoPane } from "@/components/cyberdeck/spy-echo-pane";
import { SpyMiragePane } from "@/components/cyberdeck/spy-mirage-pane";
import { SpyPowerfistPane } from "@/components/cyberdeck/spy-powerfist-pane";
import { ESPIONAGE_MISSION_SOLVE_EVENT, type EspionageMissionSolveDetail } from "@/lib/cyberdeck/powerfist-mission.types";
import { SpyProvider, useSpyContext, type SpySubPane } from "@/lib/cyberdeck/spy-context";
import { readEspionageNodeRole } from "@/lib/cyberdeck/espionage-mode";

function defaultSpySubPane(): SpySubPane {
  const role = readEspionageNodeRole();
  if (role === "echo") return "echo";
  return "mirage";
}

function SpyPaneInner() {
  const { activeSubPane, setActiveSubPane, setCapture } = useSpyContext();

  useEffect(() => {
    setActiveSubPane(defaultSpySubPane());
  }, [setActiveSubPane]);

  useEffect(() => {
    const handleMissionSolve = (event: Event) => {
      const detail = (event as CustomEvent<EspionageMissionSolveDetail>).detail;
      if (!detail?.imageDataUrl) return;
      const pngBase64 = detail.imageDataUrl.replace(/^data:image\/png;base64,/, "");
      setCapture({
        missionId: detail.missionId,
        pngBase64,
        imageDataUrl: detail.imageDataUrl,
        capturedAt: new Date().toISOString(),
      });
      setActiveSubPane("mirage");
    };

    window.addEventListener(ESPIONAGE_MISSION_SOLVE_EVENT, handleMissionSolve);
    return () => window.removeEventListener(ESPIONAGE_MISSION_SOLVE_EVENT, handleMissionSolve);
  }, [setActiveSubPane, setCapture]);

  return (
    <div className="cyberdeck-spy-pane flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-black">
      <SpySubRail active={activeSubPane} onSelect={setActiveSubPane} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSubPane === "echo" ? <SpyEchoPane /> : null}
        {activeSubPane === "mirage" ? <SpyMiragePane /> : null}
        {activeSubPane === "powerfist" ? <SpyPowerfistPane /> : null}
      </div>
    </div>
  );
}

export function CyberdeckSpyPaneBody() {
  return (
    <SpyProvider>
      <SpyPaneInner />
    </SpyProvider>
  );
}
