"use client";

export const MUTHUR_VOICE_LAB_ENABLED_STORAGE_KEY = "echo-mirage-muthur-voice-lab-enabled-v1";
export const MUTHUR_VOICE_LAB_CHANGED_EVENT = "echo-mirage-muthur-voice-lab-changed";

export function readMuthurVoiceLabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTHUR_VOICE_LAB_ENABLED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuthurVoiceLabEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_VOICE_LAB_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent(MUTHUR_VOICE_LAB_CHANGED_EVENT, { detail: { enabled } }),
    );
  } catch {
    /* ignore storage failures */
  }
}
