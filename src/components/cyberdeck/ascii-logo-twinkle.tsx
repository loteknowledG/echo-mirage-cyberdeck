"use client";

import { useMemo, type CSSProperties } from "react";
import { createAmbientTwinkleLamps } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import { useAmbientTravelingWave } from "@/lib/cyberdeck/ambient-twinkle/use-ambient-traveling-wave";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

type AsciiLogoTwinkleProps = {
  ascii: string;
  ariaLabel: string;
  className?: string;
  seedOffset?: number;
};

/**
 * ASCII logo — crisp dark baseline with circular glyph pool twinkle.
 */
export function AsciiLogoTwinkle({
  ascii,
  ariaLabel,
  className,
  seedOffset = 0,
}: AsciiLogoTwinkleProps) {
  const lamps = useMemo(
    () => createAmbientTwinkleLamps({ preset: "command-surface", seedOffset }),
    [seedOffset],
  );

  const waveSlot = useAmbientTravelingWave({
    slotCount: lamps.length,
    enabled: true,
  });

  return (
    <div
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className={cn("ascii-logo-twinkle", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="ascii-logo-twinkle__glyphs">
        <pre className="ascii-logo-twinkle__sonar" aria-hidden="true">
          {ascii}
        </pre>
        <pre className="ascii-logo-twinkle__base">{ascii}</pre>
        <div className="ascii-logo-twinkle__pools" aria-hidden="true">
          {lamps.map((lamp, index) => {
            const poolX = ((index + 0.5) / lamps.length) * 100;
            return (
              <div
                key={lamp.id}
                className={cn(
                  "ascii-logo-twinkle__pool",
                  `ascii-logo-twinkle__pool--${lamp.tone}`,
                  lamp.active && "ascii-logo-twinkle__pool--active",
                  waveSlot === index && "ascii-logo-twinkle__pool--wave",
                )}
                style={
                  {
                    "--pool-x": `${poolX}%`,
                    "--twinkle-period": `${lamp.periodMs}ms`,
                    "--twinkle-delay": `${-lamp.delayMs}ms`,
                  } as CSSProperties
                }
              >
                <pre className="ascii-logo-twinkle__lit">{ascii}</pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
