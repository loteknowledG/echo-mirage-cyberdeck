export const AMBIENT_LAMP_TONES = ["signal", "amber", "cyan", "neutral"] as const;

export type AmbientLampTone = (typeof AMBIENT_LAMP_TONES)[number];

export type AmbientTwinklePresetId = "command-surface" | "compact";

export type AmbientTwinkleLamp = {
  id: string;
  tone: AmbientLampTone;
  /** Steady-state opacity (0–1). */
  idleOpacity: number;
  /** Peak opacity during a twinkle pulse (0–1). */
  peakOpacity: number;
  /** Full animation cycle length (ms). */
  periodMs: number;
  /** Offset into the cycle (ms). */
  delayMs: number;
  /** Fraction of cycle spent near peak (0–1). Lower = briefer twinkle. */
  pulseWidth: number;
};

export type AmbientTwinklePreset = {
  id: AmbientTwinklePresetId;
  lampCount: number;
  seed: number;
  /** Target fraction of lamps that twinkle noticeably. */
  activeRatio: number;
};

export type AmbientTwinkleHostConfig = {
  preset: AmbientTwinklePresetId;
  enabled?: boolean;
};
