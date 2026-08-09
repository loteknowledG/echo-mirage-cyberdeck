"use client";

import {
  DEFAULT_CHARACTER_TTS_VOICE,
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsProfileId,
  type CharacterTtsVoice,
} from "@/lib/character-tts-profile";

export type VoiceLabTtsResult = { ok: true } | { ok: false; error: string };

export type VoiceLabTtsOptions = {
  allowFallback?: boolean;
};

let speakQueueTail: Promise<VoiceLabTtsResult> = Promise.resolve({ ok: true });
let audioContext: AudioContext | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let primedAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  return audioContext;
}

/** Call synchronously from a click/pointer handler before awaiting TTS fetches. */
export function unlockVoiceLabAudioPlayback(): void {
  if (typeof window === "undefined") return;

  const context = getAudioContext();
  if (context) void context.resume();

  try {
    if (!primedAudio) {
      primedAudio = new Audio();
      primedAudio.preload = "auto";
    }
    primedAudio.volume = 0.001;
    primedAudio.muted = false;
    if (!primedAudio.src) {
      primedAudio.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAA=";
    }
    void primedAudio
      .play()
      .then(() => {
        primedAudio?.pause();
        if (primedAudio) primedAudio.currentTime = 0;
      })
      .catch(() => undefined);
  } catch {
    /* ignore */
  }
}

function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

async function speakAudioBase64WebAudio(audioBase64: string): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;

  try {
    await context.resume();
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const buffer = await context.decodeAudioData(bytes.buffer.slice(0));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    await new Promise<void>((resolve, reject) => {
      source.onended = () => resolve();
      try {
        source.start(0);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Audio playback failed"));
      }
    });
    return true;
  } catch {
    return false;
  }
}

async function speakAudioBase64(audioBase64: string, contentType = "audio/mpeg"): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    stopActiveAudio();
    const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
    activeObjectUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;
    audio.preload = "auto";
    audio.volume = 1;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      void audio.play().catch(reject);
    });
    return true;
  } catch {
    return speakAudioBase64WebAudio(audioBase64);
  } finally {
    if (activeAudio) activeAudio = null;
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }
}

type TtsApiResponse = {
  ok?: boolean;
  audioBase64?: string;
  contentType?: string;
  error?: string;
  detail?: string;
};

function decodeAudioBase64ToArrayBuffer(audioBase64: string): ArrayBuffer {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer.slice(0);
}

/** Fetch Edge TTS audio for a Voice Lab profile (no playback). */
export async function fetchVoiceLabProfileAudio(
  text: string,
  profile: CharacterTtsProfileId,
): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined") return null;
  const speechText = text.trim().replace(/\s+/g, " ");
  if (!speechText) return null;

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ text: speechText, profile }),
    });
    const data = (await response.json().catch(() => null)) as TtsApiResponse | null;
    if (!response.ok || !data?.ok || !data.audioBase64) return null;
    return decodeAudioBase64ToArrayBuffer(data.audioBase64);
  } catch {
    return null;
  }
}

async function speakViaVoiceProfile(text: string, profile: CharacterTtsProfileId): Promise<VoiceLabTtsResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "TTS is unavailable in this environment." };
  }
  const speechText = text.trim().replace(/\s+/g, " ");
  if (!speechText) return { ok: false, error: "No speakable preview text." };

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ text: speechText, profile }),
    });
    const data = (await response.json().catch(() => null)) as TtsApiResponse | null;
    const errorMessage = data?.detail || data?.error || `TTS request failed (${response.status})`;

    if (!response.ok || !data?.ok) {
      return { ok: false, error: errorMessage };
    }
    if (data.audioBase64 && (await speakAudioBase64(data.audioBase64, data.contentType || "audio/mpeg"))) {
      return { ok: true };
    }
    return { ok: false, error: "TTS returned no playable audio." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "TTS request failed" };
  }
}

export async function previewVoiceLabProfile(
  text: string,
  profileId: CharacterTtsProfileId,
  options: VoiceLabTtsOptions = {},
): Promise<VoiceLabTtsResult> {
  unlockVoiceLabAudioPlayback();

  const run = async (): Promise<VoiceLabTtsResult> => {
    const allowFallback = options.allowFallback ?? true;
    const primary = await speakViaVoiceProfile(text, profileId);
    if (primary.ok) return primary;
    if (!allowFallback || profileId === DEFAULT_CHARACTER_TTS_VOICE.profileId) {
      return primary;
    }
    return speakViaVoiceProfile(text, DEFAULT_CHARACTER_TTS_VOICE.profileId);
  };

  const resultPromise = speakQueueTail.then(run, run);
  speakQueueTail = resultPromise.catch(() => ({ ok: false, error: "TTS queue failed." }));
  return resultPromise;
}

export async function previewVoiceLabCharacterVoice(
  text: string,
  voice?: CharacterTtsVoice | null,
  options?: VoiceLabTtsOptions,
): Promise<VoiceLabTtsResult> {
  const resolved = resolveCharacterTtsVoice(voice);
  return previewVoiceLabProfile(text, resolved.profileId, options);
}

export function stopVoiceLabPlayback(): void {
  stopActiveAudio();
}

export function readVoiceLabStoredProfile(): CharacterTtsVoice {
  if (typeof window === "undefined") return DEFAULT_CHARACTER_TTS_VOICE;
  try {
    const raw = window.localStorage.getItem("echo-mirage-voice-lab-profile-v1");
    if (!raw) return DEFAULT_CHARACTER_TTS_VOICE;
    return normalizeCharacterTtsVoice(JSON.parse(raw));
  } catch {
    return DEFAULT_CHARACTER_TTS_VOICE;
  }
}

export function writeVoiceLabStoredProfile(voice: CharacterTtsVoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("echo-mirage-voice-lab-profile-v1", JSON.stringify(voice));
  } catch {
    /* ignore */
  }
}
