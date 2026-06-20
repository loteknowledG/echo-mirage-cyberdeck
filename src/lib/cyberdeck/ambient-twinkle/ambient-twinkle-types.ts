export const AMBIENT_LAMP_TONES = ["signal", "amber", "cyan", "neutral"] as const;

export type AmbientLampTone = (typeof AMBIENT_LAMP_TONES)[number];

export type AmbientTwinklePresetId = "command-surface" | "compact" | "muthur-console";

export type AmbientTwinkleLamp = {
  id: string;
  tone: AmbientLampTone;
  /** Steady-state opacity (0–1). */
  idleOpacity: number;
  /** Ignition peak opacity (0–1). */
  peakOpacity: number;
  /** Post-flash afterglow opacity (0–1). */
  afterglowOpacity: number;
  /** Full animation cycle length (ms). */
  periodMs: number;
  /** Offset into the cycle (ms). */
  delayMs: number;
  /** Sparkle flash duration (ms). */
  sparkleMs: number;
  /** Whether this lamp runs the incandescent ignition cycle. */
  active: boolean;
  sectorId?: string;
};

export type AmbientTwinkleSector = {
  id: string;
  label: string;
  defaultTone: AmbientLampTone;
  lampCount: number;
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
