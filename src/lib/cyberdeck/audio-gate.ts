"use client";

type AudioStopHook = () => void;

let silentModeEnabled = false;
let audioMasterEnabled = true;
const stopHooks = new Set<AudioStopHook>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Central gate: Silent Mode suppresses all deck audio regardless of per-knob settings. */
export function isAudioAllowed(): boolean {
  return !silentModeEnabled && audioMasterEnabled;
}

export function isSilentModeAudioSuppressed(): boolean {
  return silentModeEnabled;
}

export function setAudioMasterEnabled(enabled: boolean): void {
  audioMasterEnabled = Boolean(enabled);
  if (!audioMasterEnabled) {
    stopAllEchoMirageAudio();
  }
  notifyListeners();
}

export function setSilentModeForAudioGate(enabled: boolean): void {
  const next = Boolean(enabled);
  if (next === silentModeEnabled) return;
  silentModeEnabled = next;
  if (silentModeEnabled) {
    stopAllEchoMirageAudio();
  }
  notifyListeners();
}

export function hydrateSilentModeAudioGate(enabled: boolean): void {
  silentModeEnabled = Boolean(enabled);
  notifyListeners();
}

export function subscribeAudioGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerAudioStopHook(hook: AudioStopHook): () => void {
  stopHooks.add(hook);
  return () => stopHooks.delete(hook);
}

export function stopAllEchoMirageAudio(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  for (const hook of stopHooks) {
    try {
      hook();
    } catch {
      /* ignore hook errors */
    }
  }

  void import("@/features/cyberdeck/runtime/deck-audio-bundle")
    .then((audio) => {
      audio.stopSonarLoop();
      audio.stopUplinkSonarPingLoop();
    })
    .catch(() => {
      /* audio bundle not loaded yet */
    });
}
