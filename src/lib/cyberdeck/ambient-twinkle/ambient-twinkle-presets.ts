import type {
  AmbientTwinklePreset,
  AmbientTwinkleSector,
} from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-types";

export const AMBIENT_TWINKLE_PRESETS: Record<
  AmbientTwinklePreset["id"],
  AmbientTwinklePreset
> = {
  "command-surface": {
    id: "command-surface",
    lampCount: 28,
    seed: 6000,
    activeRatio: 0.35,
  },
  compact: {
    id: "compact",
    lampCount: 12,
    seed: 6001,
    activeRatio: 0.35,
  },
  "muthur-console": {
    id: "muthur-console",
    lampCount: 18,
    seed: 6002,
    activeRatio: 0.35,
  },
};

export const MUTHUR_CONSOLE_SECTORS: AmbientTwinkleSector[] = [
  { id: "mission", label: "MISSION", defaultTone: "signal", lampCount: 3 },
  { id: "watch", label: "WATCH", defaultTone: "cyan", lampCount: 3 },
  { id: "memory", label: "MEMORY", defaultTone: "amber", lampCount: 3 },
  { id: "cadre", label: "CADRE", defaultTone: "neutral", lampCount: 3 },
  { id: "network", label: "NETWORK", defaultTone: "signal", lampCount: 3 },
  { id: "voice", label: "VOICE", defaultTone: "amber", lampCount: 3 },
];

export function getAmbientTwinklePreset(
  presetId: AmbientTwinklePreset["id"],
): AmbientTwinklePreset {
  return AMBIENT_TWINKLE_PRESETS[presetId];
}

export function getMuthurConsoleSectors(): AmbientTwinkleSector[] {
  return MUTHUR_CONSOLE_SECTORS;
}
