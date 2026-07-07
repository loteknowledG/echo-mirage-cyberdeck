import { MUTHUR_PRESET } from "@/voice/muthurPreset";

export type MuthurVoiceDialState = {
  ratePercent: number;
  pitchHz: number;
  volume: number;
};

export const MUTHUR_VOICE_DIALS_STORAGE_KEY = "echo-mirage-voice-dials";
export const MUTHUR_VOICE_COPY_STORAGE_KEY = "echo-mirage-muthur-voice-copy-v1";
/** Bump when MUTHUR_PRESET.backend voice/tuning changes — migrates stale localStorage dials. */
export const MUTHUR_VOICE_PRESET_REVISION = 2;
export const MUTHUR_VOICE_PRESET_REVISION_KEY = "echo-mirage-muthur-voice-preset-rev";

export const MUTHUR_VOICE_DIAL_DEFAULTS: Readonly<MuthurVoiceDialState> = Object.freeze({
  ratePercent: MUTHUR_PRESET.backend.ratePercent,
  pitchHz: MUTHUR_PRESET.backend.pitchHz,
  volume: 0.55,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDials(raw: unknown): MuthurVoiceDialState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<MuthurVoiceDialState>;
  if (
    typeof candidate.ratePercent !== "number" ||
    typeof candidate.pitchHz !== "number" ||
    typeof candidate.volume !== "number"
  ) {
    return null;
  }
  return {
    ratePercent: clamp(candidate.ratePercent, -40, 0),
    pitchHz: clamp(candidate.pitchHz, -20, 0),
    volume: clamp(candidate.volume, 0.05, 1.25),
  };
}

function readVoicePresetRevision(): number {
  if (typeof window === "undefined") return MUTHUR_VOICE_PRESET_REVISION;
  try {
    const raw = window.localStorage.getItem(MUTHUR_VOICE_PRESET_REVISION_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeVoicePresetRevision(revision: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_VOICE_PRESET_REVISION_KEY, String(revision));
  } catch {
    /* ignore */
  }
}

function migrateVoiceDialsIfPresetChanged(): MuthurVoiceDialState | null {
  if (typeof window === "undefined") return null;
  if (readVoicePresetRevision() >= MUTHUR_VOICE_PRESET_REVISION) return null;

  const migrated = { ...MUTHUR_VOICE_DIAL_DEFAULTS };
  saveMuthurVoiceMasterCopy(buildMuthurVoiceMasterCopy(migrated));
  writeVoicePresetRevision(MUTHUR_VOICE_PRESET_REVISION);
  return migrated;
}

export function buildMuthurVoiceTuning(dials: MuthurVoiceDialState) {
  return {
    ratePercent: dials.ratePercent,
    pitchHz: dials.pitchHz,
    volume: dials.volume,
    voiceType: MUTHUR_PRESET.backend.voiceType,
    gender: MUTHUR_PRESET.backend.gender,
  };
}

function normalizeMuthurVoiceMasterCopy(raw: unknown): MuthurVoiceMasterCopy | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<MuthurVoiceMasterCopy> & {
    workingDials?: unknown;
  };
  const workingDials = normalizeDials(candidate.workingDials);
  if (!workingDials) return null;
  return {
    schemaVersion: 1,
    name: "MUTHUR",
    backend: { ...MUTHUR_PRESET.backend },
    playback: { ...MUTHUR_PRESET.playback },
    fallback: { ...MUTHUR_PRESET.fallback },
    testPhrase: MUTHUR_PRESET.testPhrase,
    workingDials,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
  };
}

export function getInitialMuthurVoiceDials(): MuthurVoiceDialState {
  if (typeof window === "undefined") {
    return { ...MUTHUR_VOICE_DIAL_DEFAULTS };
  }

  const migrated = migrateVoiceDialsIfPresetChanged();
  if (migrated) return migrated;

  try {
    const storedCopy = window.localStorage.getItem(MUTHUR_VOICE_COPY_STORAGE_KEY);
    if (storedCopy) {
      const parsedCopy = normalizeMuthurVoiceMasterCopy(JSON.parse(storedCopy));
      if (parsedCopy) {
        return { ...parsedCopy.workingDials };
      }
    }

    const stored = window.localStorage.getItem(MUTHUR_VOICE_DIALS_STORAGE_KEY);
    if (stored) {
      const parsed = normalizeDials(JSON.parse(stored));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore broken saved voice state and fall back to defaults.
  }

  return { ...MUTHUR_VOICE_DIAL_DEFAULTS };
}

export function muthurBrowserSpeechTuning(dials: MuthurVoiceDialState) {
  const rateDelta = dials.ratePercent - MUTHUR_VOICE_DIAL_DEFAULTS.ratePercent;
  const pitchDelta = dials.pitchHz - MUTHUR_VOICE_DIAL_DEFAULTS.pitchHz;

  return {
    rate: clamp(0.78 + rateDelta / 100, 0.1, 1.5),
    pitch: clamp(0.82 + pitchDelta / 20, 0.1, 2),
    volume: clamp(dials.volume, 0, 1),
  };
}

export function muthurMasterGain(volume: number) {
  return clamp(volume, 0.05, 1.25);
}

export type MuthurVoiceMasterCopy = {
  schemaVersion: 1;
  name: "MUTHUR";
  backend: typeof MUTHUR_PRESET.backend;
  playback: typeof MUTHUR_PRESET.playback;
  fallback: typeof MUTHUR_PRESET.fallback;
  testPhrase: string;
  workingDials: MuthurVoiceDialState;
  updatedAt: string;
};

export function buildMuthurVoiceMasterCopy(dials: MuthurVoiceDialState): MuthurVoiceMasterCopy {
  return {
    schemaVersion: 1,
    name: "MUTHUR",
    backend: { ...MUTHUR_PRESET.backend },
    playback: { ...MUTHUR_PRESET.playback },
    fallback: { ...MUTHUR_PRESET.fallback },
    testPhrase: MUTHUR_PRESET.testPhrase,
    workingDials: { ...dials },
    updatedAt: new Date().toISOString(),
  };
}

export function saveMuthurVoiceMasterCopy(copy: MuthurVoiceMasterCopy): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_VOICE_COPY_STORAGE_KEY, JSON.stringify(copy));
    window.localStorage.setItem(MUTHUR_VOICE_DIALS_STORAGE_KEY, JSON.stringify(copy.workingDials));
  } catch {
    /* ignore */
  }
}

export function restoreMuthurVoiceMasterCopy(): MuthurVoiceDialState {
  const defaults = { ...MUTHUR_VOICE_DIAL_DEFAULTS };
  if (typeof window === "undefined") return defaults;

  try {
    window.localStorage.removeItem(MUTHUR_VOICE_COPY_STORAGE_KEY);
    window.localStorage.setItem(MUTHUR_VOICE_DIALS_STORAGE_KEY, JSON.stringify(defaults));
    writeVoicePresetRevision(MUTHUR_VOICE_PRESET_REVISION);
  } catch {
    /* ignore */
  }

  return defaults;
}
