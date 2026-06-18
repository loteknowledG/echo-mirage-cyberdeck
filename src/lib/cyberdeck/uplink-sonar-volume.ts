const UPLINK_SONAR_VOLUME_STORAGE_KEY = "echo-mirage-uplink-sonar-volume";

export const UPLINK_SONAR_SCALE_MIN = 0.05;
export const UPLINK_SONAR_SCALE_MAX = 1.5;
export const UPLINK_SONAR_VOLUME_DEFAULT = 0.55;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeUplinkSonarVolume(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return clamp(raw, UPLINK_SONAR_SCALE_MIN, UPLINK_SONAR_SCALE_MAX);
}

export function getInitialUplinkSonarVolume(): number {
  if (typeof window === "undefined") return UPLINK_SONAR_VOLUME_DEFAULT;

  try {
    const stored = window.localStorage.getItem(UPLINK_SONAR_VOLUME_STORAGE_KEY);
    if (!stored) return UPLINK_SONAR_VOLUME_DEFAULT;
    const parsed = normalizeUplinkSonarVolume(JSON.parse(stored));
    return parsed ?? UPLINK_SONAR_VOLUME_DEFAULT;
  } catch {
    return UPLINK_SONAR_VOLUME_DEFAULT;
  }
}

export function saveUplinkSonarVolume(volume: number): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeUplinkSonarVolume(volume);
  if (normalized == null) return;
  try {
    window.localStorage.setItem(UPLINK_SONAR_VOLUME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

export function sonarScaleToKnob(scale: number): number {
  const clamped = clamp(scale, UPLINK_SONAR_SCALE_MIN, UPLINK_SONAR_SCALE_MAX);
  const span = UPLINK_SONAR_SCALE_MAX - UPLINK_SONAR_SCALE_MIN;
  return Math.round(((clamped - UPLINK_SONAR_SCALE_MIN) / span) * 100);
}

export function knobToSonarScale(knob: number): number {
  const t = clamp(knob, 0, 100) / 100;
  return UPLINK_SONAR_SCALE_MIN + t * (UPLINK_SONAR_SCALE_MAX - UPLINK_SONAR_SCALE_MIN);
}
