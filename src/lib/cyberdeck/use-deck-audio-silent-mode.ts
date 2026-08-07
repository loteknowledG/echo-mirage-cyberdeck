"use client";

import { useCallback, useEffect, useState } from "react";
import { isAudioMasterEnabled, subscribeAudioGate } from "@/lib/cyberdeck/audio-gate";
import {
  hydrateDeckAudioSilentModeFromStorage,
  readDeckAudioSilentMode,
  setDeckAudioSilentMode,
} from "@/lib/cyberdeck/deck-audio-silent-mode.client";

/** Persisted deck-wide mute — suppresses speech, SFX, sonar, and alerts. */
export function useDeckAudioSilentMode(): {
  silent: boolean;
  setSilent: (enabled: boolean) => void;
} {
  const [silent, setSilentState] = useState(() => readDeckAudioSilentMode());

  useEffect(() => {
    hydrateDeckAudioSilentModeFromStorage();
    setSilentState(readDeckAudioSilentMode());
    return subscribeAudioGate(() => {
      setSilentState(!isAudioMasterEnabled());
    });
  }, []);

  const setSilent = useCallback((enabled: boolean) => {
    setDeckAudioSilentMode(enabled);
    setSilentState(enabled);
  }, []);

  return { silent, setSilent };
}
