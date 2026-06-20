import type { AmbientTwinklePreset } from "@/lib/cyberdeck/ambient-twinkle/ambient-twinkle-types";

export const AMBIENT_TWINKLE_PRESETS: Record<
  AmbientTwinklePreset["id"],
  AmbientTwinklePreset
> = {
  "command-surface": {
    id: "command-surface",
    lampCount: 28,
    seed: 6000,
    activeRatio: 0.22,
  },
  compact: {
    id: "compact",
    lampCount: 12,
    seed: 6001,
    activeRatio: 0.18,
  },
};

export function getAmbientTwinklePreset(
  presetId: AmbientTwinklePreset["id"],
): AmbientTwinklePreset {
  return AMBIENT_TWINKLE_PRESETS[presetId];
}
