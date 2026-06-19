"use client";

import { useState } from "react";
import {
  CyberdeckActionButton,
  CyberdeckMenuButton,
} from "@/components/cyberdeck/cyberdeck-control-button";
import { RailAsciiButton } from "@/components/cyberdeck/rail-ascii-button";
import { AsciiMorphButton } from "@/components/cyberdeck/ascii-morph-button";
import { DepthButton, DepthPanel } from "@/components/realmorphism";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

const RAIL_DEMO_GLYPHS = [
  { id: "m", glyph: "Ø", label: "OPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  { id: "tunes", glyph: "♫", label: "TUNES" },
  { id: "glyph", glyph: "⟁", label: "GLYPH" },
] as const;

const MENU_DEMO_ITEMS = [
  "Operator",
  "Glyph Channel",
  "Voice Lab",
  "Tunes",
  "Delete",
] as const;

type RealmorphismDesignScratchpadProps = {
  className?: string;
};

/** Bottom-of-showroom lab for Echo Mirage control morphologies (menu, rail, secondary ascii, depth). */
export function RealmorphismDesignScratchpad({ className }: RealmorphismDesignScratchpadProps) {
  const [activeRailId, setActiveRailId] = useState<string>("m");
  const [pushedToolbar, setPushedToolbar] = useState(false);

  return (
    <section
      data-morphism-design-scratchpad
      className={cn("mt-4 border-t border-[#2a3530] pt-8", className)}
    >
      <header className="mb-6 space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#7dffb4]">
          Echo Mirage Design Scratchpad
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-[#9eada7]">
          Cyberdeck-specific control styles — flat menu rows (rail context menu), primary rail tabs,
          secondary pane-toolbar asciimorphism, and mechanical depth for content zones.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="realmorphism-panel p-4">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9eada7]">
            Realmorphism — menu row
          </h3>
          <p className="mb-4 text-xs leading-5 text-[#6f7a75]">
            Flat list rows from the left-rail right-click context menu (<code className="text-[#9eada7]">.is-menu</code>
            ). No shadow wall — hover fill only.
          </p>
          <div
            className="w-fit min-w-[11rem] max-w-full rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
            role="menu"
            aria-label="Menu row demo"
          >
            {MENU_DEMO_ITEMS.map((label) => (
              <CyberdeckMenuButton
                key={label}
                type="button"
                role="menuitem"
                danger={label === "Delete"}
                onClick={() => undefined}
              >
                {label}
              </CyberdeckMenuButton>
            ))}
          </div>
        </article>

        <article className="realmorphism-panel p-4">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9eada7]">
            Asciimorphism — rail tab
          </h3>
          <p className="mb-4 text-xs leading-5 text-[#6f7a75]">
            Primary rail chrome — TerminalArt popped/pushed frames on the server rail (
            <code className="text-[#9eada7]">RailAsciiButton</code>).
          </p>
          <div
            data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
            className="cyberdeck-server-rail inline-flex w-auto flex-row items-start gap-2 rounded-sm border border-[#2a3530] bg-black px-3 py-3"
          >
            {RAIL_DEMO_GLYPHS.map((entry) => (
              <div key={entry.id} className="flex flex-col items-center gap-1">
                <cyberdeck-rail-tab data-server-tab={entry.id}>
                  <RailAsciiButton
                    glyph={entry.glyph}
                    isPushed={activeRailId === entry.id}
                    className={cn("ascii-btn", activeRailId === entry.id && "is-pushed")}
                    onClick={() => setActiveRailId(entry.id)}
                    style={{ margin: 0, cursor: "pointer", width: "2.5rem", height: "2.5rem" }}
                  />
                </cyberdeck-rail-tab>
                <span className="font-mono text-[7px] tracking-[0.06em] text-[#6f7a75]">
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="realmorphism-panel p-4">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9eada7]">
            Asciimorphism — secondary (pane toolbar)
          </h3>
          <p className="mb-4 text-xs leading-5 text-[#6f7a75]">
            Secondary asciimorphism for pane chrome toolbars — box frames with ▓ shadow stack (
            <code className="text-[#9eada7]">AsciiMorphButton</code>).
          </p>
          <div
            data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
            className="flex flex-wrap items-end gap-3 rounded-sm border border-[#2a3530] bg-black px-3 py-4"
          >
            <AsciiMorphButton size="toolbar" aria-label="Toolbar icon">
              ⧉
            </AsciiMorphButton>
            <AsciiMorphButton size="icon" aria-label="Icon">
              ↗
            </AsciiMorphButton>
            <AsciiMorphButton
              size="action"
              label="ACTION"
              isPushed={pushedToolbar}
              aria-pressed={pushedToolbar}
              onClick={() => setPushedToolbar((value) => !value)}
            />
            <AsciiMorphButton size="compact" label="COMPACT" />
            <AsciiMorphButton size="filter" label="FILTER" className="is-signal" />
          </div>
        </article>

        <article className="realmorphism-panel p-4">
          <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9eada7]">
            Asciimorphism — mechanical depth
          </h3>
          <p className="mb-4 text-xs leading-5 text-[#6f7a75]">
            Content-zone controls in ascii deck mode — square face + right/bottom walls (
            <code className="text-[#9eada7]">DepthButton</code>).
          </p>
          <div data-deck-mode="ascii" className="cyberdeck-message-box max-w-sm rounded-sm border border-[#2a3530] bg-black">
            <DepthPanel variant="module" depth={8} className="w-full">
              <div className="flex flex-wrap items-end gap-3 p-3">
                <DepthButton posture="signal" depth={4} asciiOverlay>
                  CONNECT
                </DepthButton>
                <DepthButton posture="neutral" depth={4} asciiOverlay>
                  NEUTRAL
                </DepthButton>
                <DepthButton posture="amber" depth={4} asciiOverlay>
                  AMBER
                </DepthButton>
                <CyberdeckActionButton variant="accent">LEGACY ACTION</CyberdeckActionButton>
              </div>
            </DepthPanel>
          </div>
        </article>
      </div>
    </section>
  );
}
