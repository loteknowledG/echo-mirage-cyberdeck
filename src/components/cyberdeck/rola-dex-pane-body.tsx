"use client";

import { PowerfistDeckEmbed } from "@/components/cyberdeck/powerfist-deck-embed";

/** Embedded /preview Rola Dex matrix for the MIRAGE cyberdeck pane. */
export function CyberdeckRolaDexPaneBody() {
  return (
    <div className="cyberdeck-rola-dex-pane custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#050807]">
      <PowerfistDeckEmbed className="flex-1" />
    </div>
  );
}
