"use client";

import { useMemo } from "react";
import {
  ambientTwinkleLampStyle,
  createAmbientTwinkleLamps,
} from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import type { AmbientTwinklePresetId } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-types";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

type AmbientTwinkleHostProps = {
  preset?: AmbientTwinklePresetId;
  seedOffset?: number;
  enabled?: boolean;
  label?: string;
  className?: string;
};

/**
 * Low-intensity industrial indicator lamps — ambient visual life only.
 * L-UI-LIGHT-001. No MUTHUR / mission / alarm wiring in this phase.
 */
export function AmbientTwinkleHost({
  preset = "command-surface",
  seedOffset = 0,
  enabled = true,
  label = "Ambient indicator panel",
  className,
}: AmbientTwinkleHostProps) {
  const lamps = useMemo(
    () => createAmbientTwinkleLamps({ preset, seedOffset }),
    [preset, seedOffset],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className={cn("ambient-twinkle-host", className)}
      role="img"
      aria-label={label}
    >
      <div className="ambient-twinkle-bezel">
        {lamps.map((lamp) => (
          <span
            key={lamp.id}
            className={cn("ambient-twinkle-lamp", `ambient-twinkle-lamp--${lamp.tone}`)}
            style={ambientTwinkleLampStyle(lamp)}
          />
        ))}
      </div>
    </div>
  );
}
