const DECK_SFX_VOLUME_STORAGE_KEY = "echo-mirage-deck-sfx-volume-v1";
const LEGACY_AUDIO_MUTED_KEY = "echo-mirage-audio-muted-v1";

export const DECK_SFX_SCALE_MIN = 0;
export const DECK_SFX_SCALE_MAX = 1;
export const DECK_SFX_VOLUME_DEFAULT = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDeckSfxVolume(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return clamp(raw, DECK_SFX_SCALE_MIN, DECK_SFX_SCALE_MAX);
}

function readLegacyMutedVolume(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LEGACY_AUDIO_MUTED_KEY);
    if (stored === null) return null;
    return stored === "0" ? DECK_SFX_VOLUME_DEFAULT : DECK_SFX_SCALE_MIN;
  } catch {
    return null;
  }
}

export function getInitialDeckSfxVolume(): number {
  if (typeof window === "undefined") return DECK_SFX_VOLUME_DEFAULT;

  try {
    const stored = window.localStorage.getItem(DECK_SFX_VOLUME_STORAGE_KEY);
    if (stored !== null) {
      const parsed = normalizeDeckSfxVolume(JSON.parse(stored));
      if (parsed != null) return parsed;
    }
  } catch {
    /* fall through */
  }

  return readLegacyMutedVolume() ?? DECK_SFX_VOLUME_DEFAULT;
}

export function saveDeckSfxVolume(volume: number): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeDeckSfxVolume(volume);
  if (normalized == null) return;
  try {
    window.localStorage.setItem(DECK_SFX_VOLUME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

export function deckSfxScaleToKnob(scale: number): number {
  const clamped = clamp(scale, DECK_SFX_SCALE_MIN, DECK_SFX_SCALE_MAX);
  if (DECK_SFX_SCALE_MAX <= DECK_SFX_SCALE_MIN) return 0;
  return Math.round((clamped / DECK_SFX_SCALE_MAX) * 100);
}

export function knobToDeckSfxScale(knob: number): number {
  const t = clamp(knob, 0, 100) / 100;
  return DECK_SFX_SCALE_MIN + t * (DECK_SFX_SCALE_MAX - DECK_SFX_SCALE_MIN);
}

let runtimeVolume = DECK_SFX_VOLUME_DEFAULT;
let hasLoadedRuntimeVolume = false;

export function getDeckSfxVolume(): number {
  if (!hasLoadedRuntimeVolume) {
    runtimeVolume = getInitialDeckSfxVolume();
    hasLoadedRuntimeVolume = true;
  }
  return runtimeVolume;
}

export function setDeckSfxVolumeRuntime(volume: number): number {
  const normalized = normalizeDeckSfxVolume(volume) ?? DECK_SFX_VOLUME_DEFAULT;
  runtimeVolume = normalized;
  hasLoadedRuntimeVolume = true;
  saveDeckSfxVolume(normalized);
  return normalized;
}
