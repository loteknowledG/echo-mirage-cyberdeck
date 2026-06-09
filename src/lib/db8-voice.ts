/** Per-speaker TTS profiles and sequential playback for DB8 debate. */

import { ensureTtsTextLength } from "@/lib/cyberdeck-voice-tuning";
import type { Db8SpeakerId } from "@/lib/db8-debate";

export type Db8VoiceSpeaker = Db8SpeakerId | "conclude";

export type Db8VoiceProfile = {
  voiceType: string;
  gender: "Male" | "Female";
  ratePercent: number;
  pitchHz: number;
  volume: number;
  browserHints: string[];
  browserReject?: string[];
  browserRate: number;
  browserPitch: number;
};

export type Db8DeckSpeakLine = (
  text: string,
  profile: Db8VoiceProfile,
) => Promise<void>;

export const DB8_VOICE_ENABLED_KEY = "echo-mirage-db8-voice-enabled-v1";

export const DB8_VOICE_PROFILES: Record<Db8VoiceSpeaker, Db8VoiceProfile> = {
  human: {
    voiceType: "GuyNeural",
    gender: "Male",
    ratePercent: -16,
    pitchHz: -2,
    volume: 0.72,
    browserHints: ["guy", "david", "mark", "ryan"],
    browserReject: ["zira", "jenny", "aria"],
    browserRate: 0.94,
    browserPitch: 0.88,
  },
  for: {
    voiceType: "JennyNeural",
    gender: "Female",
    ratePercent: -8,
    pitchHz: 4,
    volume: 0.68,
    browserHints: ["jenny", "aria", "sara", "sonia"],
    browserRate: 1.02,
    browserPitch: 1.08,
  },
  against: {
    voiceType: "AndrewNeural",
    gender: "Male",
    ratePercent: -24,
    pitchHz: -10,
    volume: 0.7,
    browserHints: ["andrew", "guy", "davis", "tony"],
    browserRate: 0.88,
    browserPitch: 0.78,
  },
  moderator: {
    voiceType: "MichelleNeural",
    gender: "Female",
    ratePercent: -32,
    pitchHz: -14,
    volume: 0.66,
    browserHints: ["michelle", "zira", "susan", "hazel"],
    browserRate: 0.84,
    browserPitch: 0.9,
  },
  system: {
    voiceType: "SoniaNeural",
    gender: "Female",
    ratePercent: -28,
    pitchHz: -8,
    volume: 0.6,
    browserHints: ["sonia", "libby", "mia"],
    browserRate: 0.86,
    browserPitch: 0.92,
  },
  conclude: {
    voiceType: "SoniaNeural",
    gender: "Female",
    ratePercent: -30,
    pitchHz: -12,
    volume: 0.68,
    browserHints: ["sonia", "michelle", "zira"],
    browserRate: 0.82,
    browserPitch: 0.88,
  },
};

export function readDb8VoiceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(DB8_VOICE_ENABLED_KEY);
    if (raw === "0" || raw === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function writeDb8VoiceEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB8_VOICE_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let db8AudioContext: AudioContext | null = null;
let db8MasterGain: GainNode | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeHtmlAudio: HTMLAudioElement | null = null;
let voicesWarm = false;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/** Call from a user gesture (button click) so later async TTS can play. */
export async function unlockDb8Audio(): Promise<void> {
  const Ctx = getAudioContextCtor();
  if (!Ctx) return;

  db8AudioContext ??= new Ctx();
  if (!db8MasterGain) {
    db8MasterGain = db8AudioContext.createGain();
    db8MasterGain.gain.value = 1;
    db8MasterGain.connect(db8AudioContext.destination);
  }

  if (db8AudioContext.state === "suspended") {
    await db8AudioContext.resume();
  }

  const tick = db8AudioContext.createBuffer(1, 1, db8AudioContext.sampleRate);
  const tickSource = db8AudioContext.createBufferSource();
  tickSource.buffer = tick;
  tickSource.connect(db8MasterGain);
  tickSource.start();

  if (!voicesWarm && "speechSynthesis" in window) {
    voicesWarm = true;
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }
}

function waitForBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const onChange = () => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onChange);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    }, 1200);
  });
}

function pickBrowserVoice(
  profile: Db8VoiceProfile,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const reject = new Set((profile.browserReject ?? []).map((v) => v.toLowerCase()));

  const pool = voices.filter((voice) => {
    const blob = `${voice.name} ${voice.lang} ${voice.voiceURI}`.toLowerCase();
    if (reject.size > 0 && [...reject].some((bad) => blob.includes(bad))) return false;
    return true;
  });

  for (const hint of profile.browserHints) {
    const match = pool.find((voice) => {
      const blob = `${voice.name} ${voice.lang}`.toLowerCase();
      return blob.includes(hint.toLowerCase());
    });
    if (match) return match;
  }

  return pool[0] ?? voices[0] ?? null;
}

async function synthesizeDb8Speech(text: string, profile: Db8VoiceProfile): Promise<ArrayBuffer> {
  const ttsText = ensureTtsTextLength(text);
  const res = await fetch("/api/cyberdeck-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: ttsText,
      voiceTuning: {
        voiceType: profile.voiceType,
        gender: profile.gender,
        ratePercent: profile.ratePercent,
        pitchHz: profile.pitchHz,
        volume: profile.volume,
      },
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (res.ok && contentType.startsWith("audio/")) {
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 0) return buffer;
    throw new Error("DB8 voice backend returned empty audio");
  }

  if (contentType.includes("application/json")) {
    const diagnostic = await res.json().catch(() => null);
    const message =
      diagnostic && typeof diagnostic === "object" && typeof diagnostic.message === "string"
        ? diagnostic.message
        : `Voice API HTTP ${res.status}`;
    throw new Error(message);
  }

  throw new Error(`Voice API HTTP ${res.status}`);
}

export function stopDb8Audio(): void {
  if (activeHtmlAudio) {
    activeHtmlAudio.pause();
    activeHtmlAudio.removeAttribute("src");
    activeHtmlAudio.load();
    activeHtmlAudio = null;
  }
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      /* already stopped */
    }
    activeSource = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function playWithHtmlAudio(buffer: ArrayBuffer, volume: number): Promise<void> {
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.volume = Math.min(1, Math.max(0.05, volume));

  stopDb8Audio();
  activeHtmlAudio = audio;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (activeHtmlAudio === audio) activeHtmlAudio = null;
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("HTML Audio playback failed"));
    };

    audio.src = url;
    void audio.play().catch((error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("audio.play() rejected"));
    });
  });
}

async function playMp3WithWebAudio(buffer: ArrayBuffer, volume: number): Promise<void> {
  await unlockDb8Audio();
  const ctx = db8AudioContext;
  const master = db8MasterGain;
  if (!ctx || !master) {
    throw new Error("DB8 audio context unavailable");
  }

  const decoded = await ctx.decodeAudioData(buffer.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = decoded;
  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, Math.max(0.05, volume));
  source.connect(gain);
  gain.connect(master);

  stopDb8Audio();
  activeSource = source;

  await new Promise<void>((resolve, reject) => {
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      resolve();
    };
    try {
      source.start(0);
    } catch (error) {
      if (activeSource === source) activeSource = null;
      reject(error instanceof Error ? error : new Error("DB8 WebAudio start failed"));
    }
  });
}

async function playMp3Buffer(buffer: ArrayBuffer, volume: number): Promise<void> {
  await unlockDb8Audio();

  try {
    await playWithHtmlAudio(buffer, volume);
    return;
  } catch (htmlError) {
    console.warn("[db8-voice] HTML Audio failed, trying WebAudio", htmlError);
  }

  await playMp3WithWebAudio(buffer, volume);
}

async function speakBrowserFallback(text: string, profile: Db8VoiceProfile): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("speechSynthesis unavailable");
  }

  await unlockDb8Audio();
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();

  const voices = await waitForBrowserVoices();
  const voice = pickBrowserVoice(profile, voices);
  if (!voice) {
    throw new Error("No browser voice available for DB8 speaker");
  }

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || "en-US";
    utterance.rate = profile.browserRate;
    utterance.pitch = profile.browserPitch;
    utterance.volume = Math.min(1, Math.max(0.05, profile.volume));

    let spoke = false;
    utterance.onstart = () => {
      spoke = true;
    };
    utterance.onend = () => {
      if (!spoke) {
        reject(new Error("Browser TTS never started (likely blocked)"));
        return;
      }
      resolve();
    };
    utterance.onerror = (event) => {
      reject(new Error(event.error || "DB8 browser TTS failed"));
    };

    synth.cancel();
    window.setTimeout(() => {
      synth.speak(utterance);
    }, 60);
  });
}

export async function speakDb8Line(
  speaker: Db8VoiceSpeaker,
  text: string,
  opts?: { signal?: AbortSignal; deckSpeak?: Db8DeckSpeakLine },
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (opts?.signal?.aborted) return;

  const profile = DB8_VOICE_PROFILES[speaker];

  if (opts?.deckSpeak) {
    await unlockDb8Audio();
    await opts.deckSpeak(trimmed, profile);
    return;
  }

  let lastError: Error | null = null;

  try {
    const buffer = await synthesizeDb8Speech(trimmed, profile);
    if (opts?.signal?.aborted) return;
    await playMp3Buffer(buffer, profile.volume);
    return;
  } catch (error) {
    lastError = error instanceof Error ? error : new Error("DB8 backend playback failed");
    console.warn("[db8-voice] backend failed, using browser fallback", lastError);
  }

  if (opts?.signal?.aborted) return;

  try {
    await speakBrowserFallback(trimmed, profile);
    return;
  } catch (error) {
    const fallbackError = error instanceof Error ? error : new Error("DB8 browser TTS failed");
    throw lastError ?? fallbackError;
  }
}

export type Db8SpeechItem = {
  speaker: Db8VoiceSpeaker;
  text: string;
};

export class Db8VoiceQueue {
  private generation = 0;
  private deckSpeak?: Db8DeckSpeakLine;

  setDeckSpeak(handler: Db8DeckSpeakLine | undefined): void {
    this.deckSpeak = handler;
  }

  cancel(): void {
    this.generation += 1;
    stopDb8Audio();
  }

  async speakSequence(items: Db8SpeechItem[], enabled: boolean): Promise<void> {
    if (!enabled || items.length === 0) return;
    const runId = ++this.generation;

    for (const item of items) {
      if (runId !== this.generation) return;
      if (!item.text.trim()) continue;
      await speakDb8Line(item.speaker, item.text, { deckSpeak: this.deckSpeak });
    }
  }

  async speakOne(speaker: Db8VoiceSpeaker, text: string, enabled: boolean): Promise<void> {
    return this.speakSequence([{ speaker, text }], enabled);
  }
}

export function operatorPropositionSpeech(topic: string): string {
  return `Proposition. ${topic}`;
}
