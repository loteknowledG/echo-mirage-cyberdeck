"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";

/** Voice Lab rail / tab — MUTHUR voice experimentation surface (scaffold). */
export function CyberdeckVoiceLabPaneBody() {
  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                VOICE LAB
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                SPEECH PLANE // PRESETS · CHAIN · PROBE
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 font-mono text-[10px] tracking-[0.08em] text-[#666]">
          BLANK VOICE LAB // ASSIGN CONTROLS IN NEXT SLICE
        </div>
      </div>
    </div>
  );
}
