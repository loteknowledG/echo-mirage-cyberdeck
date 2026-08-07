"use client";

import { setAudioMasterEnabled } from "@/lib/cyberdeck/audio-gate";

export const DECK_AUDIO_SILENT_STORAGE_KEY = "echo-mirage-deck-audio-silent-v1";

export function readDeckAudioSilentMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DECK_AUDIO_SILENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDeckAudioSilentMode(silent: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DECK_AUDIO_SILENT_STORAGE_KEY, silent ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
}

/** Apply persisted silent preference to the central audio gate. */
export function hydrateDeckAudioSilentModeFromStorage(): void {
  setAudioMasterEnabled(!readDeckAudioSilentMode());
}

export function setDeckAudioSilentMode(silent: boolean): void {
  writeDeckAudioSilentMode(silent);
  setAudioMasterEnabled(!silent);
}
