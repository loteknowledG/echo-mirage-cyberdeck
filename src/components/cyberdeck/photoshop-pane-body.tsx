"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";

/** Photoshop workspace pane — image tooling wired later. */
export function CyberdeckPhotoshopPaneBody() {
  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
                PHOTOSHOP
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>IMAGE LAB // LAYERS // EXPORT</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-3 p-6 font-mono text-[10px] tracking-[0.08em] text-[#6a6a6a]">
          <span>NO DOCUMENT OPEN</span>
          <span className="text-[8px] tracking-[0.12em] text-[#505050]">
            DROP AN IMAGE OR OPEN FROM OPERATOR TO BEGIN
          </span>
        </div>
      </div>
    </div>
  );
}
