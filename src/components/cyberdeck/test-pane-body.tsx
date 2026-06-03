"use client";

import { MatrixCarousel } from "@/components/cyberdeck/matrix-carousel";
import { PowerfistModeRoller } from "@/components/cyberdeck/powerfist-mode-roller";
import { RadialMenu } from "@/components/cyberdeck/radial-menu";

export function CyberdeckTestPaneBody() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center gap-8 overflow-auto bg-slate-950 p-4">
      <section className="flex shrink-0 flex-wrap items-start justify-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">
            Powerfist radial
          </p>
          <RadialMenu />
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">
            Powerfist vertical loop
          </p>
          <PowerfistModeRoller />
        </div>
      </section>

      <section className="flex w-full min-h-0 flex-1 flex-col items-center">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">
          Matrix · vertical decks + horizontal cards (Powerfist lanes)
        </p>
        <MatrixCarousel />
      </section>
    </div>
  );
}
