"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";

/** Blank sound profile pane — profile slots wired later. */
export function CyberdeckSoundProfilePaneBody() {
  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                SOUND PROFILE
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>DECK AUDIO // PROFILE MATRIX</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="flex min-h-[40vh] flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#6a6a6a]">
          NO PROFILE LOADED // STANDBY
        </div>
      </div>
    </div>
  );
}
