"use client";

import type { SurveyMirageSttEngine } from "@/lib/cyberdeck/mirage-local-listening-shared.client";

export type SurveyListeningLang =
  | "auto"
  | "en-US"
  | "en-GB"
  | "en-AU"
  | "en-IN"
  | "en-CA";

export type SurveyListeningPreferences = {
  /** Whisper (server) or browser Web Speech. */
  sttEngine: SurveyMirageSttEngine;
  /** Web Speech / Whisper language hint — auto uses `navigator.language`. */
  lang: SurveyListeningLang;
  /** Preferred mic from enumerateDevices(); empty = system default. */
  micDeviceId: string;
  /** Skip noise suppression / AGC — sometimes clearer for quiet or accented speech. */
  rawMic: boolean;
};

export const SURVEY_LISTENING_PREFERENCES_CHANGED_EVENT =
  "echo-mirage-survey-listening-preferences-changed";

const STORAGE_KEY = "echo-mirage-survey-listening-preferences-v2";

const DEFAULT_PREFERENCES: SurveyListeningPreferences = {
  sttEngine: "whisper",
  lang: "auto",
  micDeviceId: "",
  rawMic: false,
};

let preferences: SurveyListeningPreferences = { ...DEFAULT_PREFERENCES };
let hydrated = false;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SURVEY_LISTENING_PREFERENCES_CHANGED_EVENT, {
      detail: { ...preferences },
    }),
  );
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SurveyListeningPreferences>;
    preferences = {
      sttEngine:
        parsed.sttEngine === "web-speech" || parsed.sttEngine === "whisper"
          ? parsed.sttEngine
          : DEFAULT_PREFERENCES.sttEngine,
      lang: parsed.lang ?? DEFAULT_PREFERENCES.lang,
      micDeviceId: typeof parsed.micDeviceId === "string" ? parsed.micDeviceId : "",
      rawMic: Boolean(parsed.rawMic),
    };
  } catch {
    preferences = { ...DEFAULT_PREFERENCES };
  }
}

export function readSurveyListeningPreferences(): SurveyListeningPreferences {
  hydrateFromStorage();
  return { ...preferences };
}

export function setSurveyListeningPreferences(
  patch: Partial<SurveyListeningPreferences>,
): SurveyListeningPreferences {
  hydrateFromStorage();
  preferences = { ...preferences, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      /* ignore quota */
    }
  }
  emit();
  return { ...preferences };
}

export function subscribeSurveyListeningPreferences(
  listener: (next: SurveyListeningPreferences) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener(readSurveyListeningPreferences());
  window.addEventListener(SURVEY_LISTENING_PREFERENCES_CHANGED_EVENT, handler);
  listener(readSurveyListeningPreferences());
  return () =>
    window.removeEventListener(SURVEY_LISTENING_PREFERENCES_CHANGED_EVENT, handler);
}

/** Resolved BCP-47 tag for Web Speech API. */
export function resolveMirageSpeechLang(): string {
  const { lang } = readSurveyListeningPreferences();
  if (lang !== "auto") return lang;
  const navLang = typeof navigator !== "undefined" ? navigator.language.trim() : "";
  return navLang || "en-US";
}

export const SURVEY_LISTENING_LANG_OPTIONS: Array<{
  value: SurveyListeningLang;
  label: string;
}> = [
  { value: "auto", label: "Auto (browser locale)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-IN", label: "English (India)" },
  { value: "en-CA", label: "English (Canada)" },
];

export async function listSurveyListeningMicDevices(): Promise<
  Array<{ deviceId: string; label: string }>
> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label?.trim() || `Microphone ${index + 1}`,
    }));
}

/** Grant mic permission so device labels populate. */
export async function warmSurveyListeningMicPermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return true;
  } catch {
    return false;
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
  }
}
