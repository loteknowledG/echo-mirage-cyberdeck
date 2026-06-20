import { getAmbientTwinklePreset } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-presets";
import type {
  AmbientLampTone,
  AmbientTwinkleLamp,
  AmbientTwinklePresetId,
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
    const tone = pickTone(rng);
    const isActive = activeSlots.has(index);
    const idleOpacity = clamp(0.08 + rng() * 0.14, 0.06, 0.22);
    const peakOpacity = isActive
      ? clamp(idleOpacity + 0.18 + rng() * 0.35, idleOpacity + 0.12, 0.72)
      : clamp(idleOpacity + 0.04 + rng() * 0.08, idleOpacity, 0.28);
    const periodMs = Math.round(7000 + rng() * 14000);
    const delayMs = Math.round(rng() * periodMs);
    const pulseWidth = isActive ? clamp(0.04 + rng() * 0.06, 0.03, 0.12) : 0.02;

    return {
      id: `lamp-${input.preset}-${index}`,
      tone,
      idleOpacity,
      peakOpacity,
      periodMs,
      delayMs,
      pulseWidth,
    };
  });
}

export function ambientTwinkleLampStyle(lamp: AmbientTwinkleLamp): Record<string, string | number> {
  return {
    "--lamp-idle-opacity": lamp.idleOpacity,
    "--lamp-peak-opacity": lamp.peakOpacity,
    "--twinkle-period": `${lamp.periodMs}ms`,
    "--twinkle-delay": `${-lamp.delayMs}ms`,
    "--twinkle-pulse-width": `${Math.round(lamp.pulseWidth * 100)}%`,
  };
}
