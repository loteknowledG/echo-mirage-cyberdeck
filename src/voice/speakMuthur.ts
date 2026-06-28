import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import { isAudioAllowed } from "@/lib/cyberdeck/audio-gate";

const MUTHUR_VOICE_REJECT = [
  "david",
  "mark",
  "guy",
  "george",
  "male",
  "jenny",
  "milena",
  "yuri",
  "katya",
  "russian",
  "ru-ru",
  "ru_ru",
];

/** Windows + macOS English female voices for MUTHUR fallback. */
const MUTHUR_VOICE_PREFER = [
  "zira",
  "aria",
  "hazel",
  "susan",
  "samantha",
  "karen",
  "moira",
  "allison",
  "ava",
  "victoria",
  "sonia",
  "siri female",
];

function voiceBlob(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.lang} ${voice.voiceURI}`.toLowerCase();
}

function isEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith("en");
}

export function selectMuthurFallbackVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter(isEnglishVoice);

  const safeVoices = englishVoices.filter((voice) => {
    const blob = voiceBlob(voice);
    return !MUTHUR_VOICE_REJECT.some((bad) => blob.includes(bad));
  });

  for (const wanted of MUTHUR_VOICE_PREFER) {
    const match = safeVoices.find((voice) => voiceBlob(voice).includes(wanted));
    if (match) return match;
  }

  const enUs = safeVoices.find((voice) => voice.lang.toLowerCase().startsWith("en-us"));
  if (enUs) return enUs;

  return safeVoices[0] ?? null;
}

export type DryFallbackTuning = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

export function speakDryFallback(text: string, tuning?: DryFallbackTuning): Promise<void> {
  if (!isAudioAllowed()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const run = () => {
      const voice = selectMuthurFallbackVoice();

      if (!voice) {
        reject(new Error("No acceptable MUTHUR fallback voice found."));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
      utterance.rate = tuning?.rate ?? MUTHUR_PRESET.fallback.rate;
      utterance.pitch = tuning?.pitch ?? MUTHUR_PRESET.fallback.pitch;
      utterance.volume = tuning?.volume ?? MUTHUR_PRESET.fallback.volume;

      console.warn("[muthur] DRY_FALLBACK selected voice:", voice.name, voice.lang);

      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error || new Error("DRY_FALLBACK speechSynthesis failed"));

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      reject(new Error("speechSynthesis unavailable"));
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      run();
      return;
    }

    const previousHandler = window.speechSynthesis.onvoiceschanged;
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = previousHandler;
      run();
    };
  });
}
