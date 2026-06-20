"use client";

import { useMemo } from "react";
import {
  ambientTwinkleLampStyle,
  createSectorAmbientLamps,
} from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import { getMuthurConsoleSectors } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-presets";
import { useAmbientTravelingWave } from "@/lib/cyberdeck/ambient-twinkle/use-ambient-traveling-wave";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

type MuthurAnnunciatorPanelProps = {
  enabled?: boolean;
  className?: string;
};

/**
 * MUTHUR ship-computer annunciator strip — sector labels wake when lamps brighten.
 * Ambient only; no event wiring in this phase.
 */
export function MuthurAnnunciatorPanel({
  enabled = true,
  className,
}: MuthurAnnunciatorPanelProps) {
  const sectors = useMemo(() => getMuthurConsoleSectors(), []);

  const lamps = useMemo(
    () =>
      createSectorAmbientLamps({
        sectors,
        seed: 6002,
        activeRatio: 0.35,
      }),
    [sectors],
  );

  const lampsBySector = useMemo(() => {
    const grouped = new Map<string, typeof lamps>();
    for (const lamp of lamps) {
      if (!lamp.sectorId) continue;
      const bucket = grouped.get(lamp.sectorId) ?? [];
      bucket.push(lamp);
      grouped.set(lamp.sectorId, bucket);
    }
    return grouped;
  }, [lamps]);

  const waveSlot = useAmbientTravelingWave({
    slotCount: sectors.length,
    enabled,
  });

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className={cn("ambient-twinkle-host muthur-annunciator-panel", className)}
      role="img"
      aria-label="MUTHUR annunciator console"
    >
      <div className="muthur-annunciator-bezel">
        {sectors.map((sector, sectorIndex) => {
          const sectorLamps = lampsBySector.get(sector.id) ?? [];
          const hasActiveLamp = sectorLamps.some((lamp) => lamp.active);
          const isWave = waveSlot === sectorIndex;

          return (
            <div
              key={sector.id}
              className={cn(
                "muthur-annunciator-sector",
                hasActiveLamp && "muthur-annunciator-sector--armed",
                isWave && "muthur-annunciator-sector--wave",
              )}
            >
              <span className="muthur-annunciator-label">{sector.label}</span>
              <div className="muthur-annunciator-lamps">
                {sectorLamps.map((lamp) => (
                  <span
                    key={lamp.id}
                    className={cn(
                      "ambient-twinkle-lamp",
                      `ambient-twinkle-lamp--${lamp.tone}`,
                      lamp.active && "ambient-twinkle-lamp--active",
                      isWave && "ambient-twinkle-lamp--wave",
                    )}
                    style={ambientTwinkleLampStyle(lamp)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
