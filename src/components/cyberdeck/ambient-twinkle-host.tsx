"use client";

import { useMemo } from "react";
import {
  ambientTwinkleLampStyle,
  createAmbientTwinkleLamps,
} from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import type { AmbientTwinklePresetId } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-types";
import { useAmbientTravelingWave } from "@/lib/cyberdeck/ambient-twinkle/use-ambient-traveling-wave";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

type AmbientTwinkleHostProps = {
  preset?: AmbientTwinklePresetId;
  seedOffset?: number;
  enabled?: boolean;
  travelingWave?: boolean;
  label?: string;
  className?: string;
};

/**
 * Industrial indicator lamps — ambient visual life only.
 * L-UI-LIGHT-001. No MUTHUR / mission / alarm wiring in this phase.
 */
export function AmbientTwinkleHost({
  preset = "command-surface",
  seedOffset = 0,
  enabled = true,
  travelingWave = true,
  label = "Ambient indicator panel",
  className,
}: AmbientTwinkleHostProps) {
  const lamps = useMemo(
    () => createAmbientTwinkleLamps({ preset, seedOffset }),
    [preset, seedOffset],
  );

  const waveSlot = useAmbientTravelingWave({
    slotCount: lamps.length,
    enabled: enabled && travelingWave,
  });

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
        {lamps.map((lamp, index) => (
          <span
            key={lamp.id}
            className={cn(
              "ambient-twinkle-lamp",
              `ambient-twinkle-lamp--${lamp.tone}`,
              lamp.active && "ambient-twinkle-lamp--active",
              waveSlot === index && "ambient-twinkle-lamp--wave",
            )}
            style={ambientTwinkleLampStyle(lamp)}
          />
        ))}
      </div>
    </div>
  );
}
