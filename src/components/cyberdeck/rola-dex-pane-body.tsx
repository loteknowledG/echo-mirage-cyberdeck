"use client";

import { DeckMatrixEmbed } from "@/components/cyberdeck/deck-matrix-embed";

/** Embedded /preview Rola Dex matrix for the MIRAGE cyberdeck pane. */
export function CyberdeckRolaDexPaneBody() {
  return (
    <div className="cyberdeck-rola-dex-pane custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#050807]">
      <DeckMatrixEmbed className="flex-1" embedSurface="rola-dex" />
    </div>
  );
}
