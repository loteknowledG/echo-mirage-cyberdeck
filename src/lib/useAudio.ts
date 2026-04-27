"use client";

import { useRef, useCallback, useEffect } from "react";
import { setupAudio, playSystemSound, playKeySound, unlockKeyboardSfx } from "@/lib/AudioEngine";

export function useAudio() {
  const clickRef = useRef<HTMLAudioElement | null>(null);
  const chirpRef = useRef<HTMLAudioElement | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setupAudio();
    unlockKeyboardSfx();
    clickRef.current = new Audio("/chime_quiet.wav");
    clickRef.current.volume = 0.3;
    chirpRef.current = new Audio("/chime.wav");
    chirpRef.current.volume = 0.5;
  }, []);

  const playClick = useCallback(() => {
    playSystemSound("click", 0.08);
  }, []);

  const playChirp = useCallback(() => {
    playSystemSound("chirp");
  }, []);

  const playKey = useCallback((key: string) => {
    playKeySound(key, { mode: "cyberdeck", volume: 1 });
  }, []);

  return { playClick, playChirp, playKey };
}