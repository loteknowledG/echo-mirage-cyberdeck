"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";

/** MUTHUR-LOAD rail / tab — portable knowledge packaging (manifesto §VII). */
export function CyberdeckMuthurLoadPaneBody() {
  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MUTHUR-LOAD
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                PORTABLE KNOWLEDGE // PACK · LOAD · SHARE
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="flex flex-1 flex-col gap-4 px-4 py-6 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-[#8a8a8a]">
          <p>
            Package relationship slices into shareable loads. First milestone: send a m4trix moment
            — recipient opens m4trix with that content and context.
          </p>
          <p className="text-[#5f5f5f]">
            PACK // ingest operator or m4trix artifacts · attach edges · provenance
            <br />
            LOAD // open an inbound load URL · hydrate the graph slice
            <br />
            SHARE // copy a portable link — knowledge travels; storage is temporary
          </p>
          <div className="mt-auto rounded border border-dashed border-[#1c1c1c] bg-[#060606] px-3 py-4 text-[9px] text-[#666]">
            No loads yet. API and pack UI ship in the next slice.
          </div>
        </div>
      </div>
    </div>
  );
}
