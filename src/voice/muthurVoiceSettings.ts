import { MUTHUR_PRESET } from "@/voice/muthurPreset";

export type MuthurVoiceDialState = {
  ratePercent: number;
  pitchHz: number;
  volume: number;
};

export const MUTHUR_VOICE_DIALS_STORAGE_KEY = "echo-mirage-voice-dials";

export const MUTHUR_VOICE_DIAL_DEFAULTS: Readonly<MuthurVoiceDialState> = Object.freeze({
  ratePercent: MUTHUR_PRESET.backend.ratePercent,
  pitchHz: MUTHUR_PRESET.backend.pitchHz,
  volume: 0.55,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getInitialMuthurVoiceDials(): MuthurVoiceDialState {
  if (typeof window === "undefined") {
    return { ...MUTHUR_VOICE_DIAL_DEFAULTS };
  }

  try {
    const stored = window.localStorage.getItem(MUTHUR_VOICE_DIALS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<MuthurVoiceDialState>;
      return {
        ratePercent:
          typeof parsed.ratePercent === "number"
            ? parsed.ratePercent
            : MUTHUR_VOICE_DIAL_DEFAULTS.ratePercent,
        pitchHz:
          typeof parsed.pitchHz === "number" ? parsed.pitchHz : MUTHUR_VOICE_DIAL_DEFAULTS.pitchHz,
        volume:
          typeof parsed.volume === "number"
            ? clamp(parsed.volume, 0, 1.25)
            : MUTHUR_VOICE_DIAL_DEFAULTS.volume,
      };
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
