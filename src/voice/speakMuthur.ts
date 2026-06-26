import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import { isAudioAllowed } from "@/lib/cyberdeck/audio-gate";

export function selectMuthurFallbackVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();

  const reject = ["david", "mark", "guy", "george", "male", "jenny"];
  const prefer = ["zira", "aria", "hazel", "susan", "female"];

  const safeVoices = voices.filter((voice) => {
    const name = `${voice.name} ${voice.lang} ${voice.voiceURI}`.toLowerCase();
    return !reject.some((bad) => name.includes(bad));
  });

  for (const wanted of prefer) {
    const match = safeVoices.find((voice) =>
      `${voice.name} ${voice.lang} ${voice.voiceURI}`.toLowerCase().includes(wanted),
    );
    if (match) return match;
  }

  return null;
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
      utterance.rate = tuning?.rate ?? MUTHUR_PRESET.fallback.rate;
      utterance.pitch = tuning?.pitch ?? MUTHUR_PRESET.fallback.pitch;
      utterance.volume = tuning?.volume ?? MUTHUR_PRESET.fallback.volume;

      console.warn("[muthur] DRY_FALLBACK selected voice:", voice.name);

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
