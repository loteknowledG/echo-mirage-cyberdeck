'use client';

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";

/** Blank shell for the dedicated SETTINGS rail / `settings` command surface. */
export function CyberdeckSettingsPaneBody() {
  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                SETTINGS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>CONFIG PLANE // RESERVED</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="flex min-h-[min(48vh,420px)] flex-1 items-center justify-center px-6 py-10 font-mono text-[10px] tracking-[0.08em] text-[#5a5a5a]">
          NO PARAMETERS BOUND // AWAITING ALLOCATION
        </div>
      </div>
    </div>
  );
}
