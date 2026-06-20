import { getAmbientTwinklePreset } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-presets";
import type {
  AmbientLampTone,
  AmbientTwinkleLamp,
  AmbientTwinklePresetId,
  AmbientTwinkleSector,
} from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-types";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTone(rng: () => number): AmbientLampTone {
  const roll = rng();
  if (roll < 0.42) return "signal";
  if (roll < 0.62) return "neutral";
  if (roll < 0.82) return "amber";
  return "cyan";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildLamp(
  rng: () => number,
  input: {
    id: string;
    tone: AmbientLampTone;
    isActive: boolean;
    sectorId?: string;
  },
): AmbientTwinkleLamp {
  const idleOpacity = clamp(0.05 + rng() * 0.05, 0.05, 0.1);
  const peakOpacity = input.isActive
    ? clamp(0.55 + rng() * 0.35, 0.6, 0.95)
    : clamp(idleOpacity + 0.06 + rng() * 0.1, idleOpacity, 0.28);
  const afterglowOpacity = input.isActive
    ? clamp(peakOpacity * (0.32 + rng() * 0.12), 0.2, 0.45)
    : clamp(idleOpacity + 0.04, idleOpacity, 0.18);
  const periodMs = Math.round(6000 + rng() * 12000);
  const delayMs = Math.round(rng() * periodMs);
  const sparkleMs = Math.round(100 + rng() * 150);

  return {
    id: input.id,
    tone: input.tone,
    idleOpacity,
    peakOpacity,
    afterglowOpacity,
    periodMs,
    delayMs,
    sparkleMs,
    active: input.isActive,
    sectorId: input.sectorId,
  };
}

export function createAmbientTwinkleLamps(input: {
  preset: AmbientTwinklePresetId;
  seedOffset?: number;
}): AmbientTwinkleLamp[] {
  const preset = getAmbientTwinklePreset(input.preset);
  const rng = mulberry32(preset.seed + (input.seedOffset ?? 0));
  const activeSlots = new Set<number>();

  const activeCount = Math.max(1, Math.round(preset.lampCount * preset.activeRatio));
  while (activeSlots.size < activeCount) {
    activeSlots.add(Math.floor(rng() * preset.lampCount));
  }

  return Array.from({ length: preset.lampCount }, (_, index) => {
    const isActive = activeSlots.has(index);
    return buildLamp(rng, {
      id: `lamp-${input.preset}-${index}`,
      tone: pickTone(rng),
      isActive,
    });
  });
}

export function createSectorAmbientLamps(input: {
  sectors: AmbientTwinkleSector[];
  seed: number;
  activeRatio?: number;
}): AmbientTwinkleLamp[] {
  const rng = mulberry32(input.seed);
  const lamps: AmbientTwinkleLamp[] = [];
  const ratio = input.activeRatio ?? 0.35;

  for (const sector of input.sectors) {
    const activeCount = Math.max(1, Math.round(sector.lampCount * ratio));
    const activeSlots = new Set<number>();
    while (activeSlots.size < activeCount) {
      activeSlots.add(Math.floor(rng() * sector.lampCount));
    }

    for (let index = 0; index < sector.lampCount; index += 1) {
      lamps.push(
        buildLamp(rng, {
          id: `lamp-${sector.id}-${index}`,
          tone: sector.defaultTone,
          isActive: activeSlots.has(index),
          sectorId: sector.id,
        }),
      );
    }
  }

  return lamps;
}

export function ambientTwinkleLampStyle(lamp: AmbientTwinkleLamp): Record<string, string | number> {
  return {
    "--lamp-idle-opacity": lamp.idleOpacity,
    "--lamp-peak-opacity": lamp.peakOpacity,
    "--lamp-afterglow-opacity": lamp.afterglowOpacity,
    "--twinkle-period": `${lamp.periodMs}ms`,
    "--twinkle-delay": `${-lamp.delayMs}ms`,
    "--twinkle-sparkle-ms": `${lamp.sparkleMs}ms`,
  };
}

export function countActiveAmbientLamps(lamps: AmbientTwinkleLamp[]): number {
  return lamps.filter((lamp) => lamp.active).length;
}
