"use client";

import { useEffect } from "react";
import { hydrateDeckAudioSilentModeFromStorage } from "@/lib/cyberdeck/deck-audio-silent-mode.client";
import { bindSilentModeAudioGate } from "@/lib/electron/silent-mode";

/** Sync persisted mute + Electron Silent Mode with the central audio gate. */
export function useSilentModeAudioGateSync(): void {
  useEffect(() => {
    hydrateDeckAudioSilentModeFromStorage();
    return bindSilentModeAudioGate();
  }, []);
}
