"use client";

import { useEffect } from "react";
import { subscribeSignals, type DeckSignal } from "@/lib/cyberdeck/signal-router";
import { isAudioAllowed } from "@/lib/cyberdeck/audio-gate";
import { playBack, playBeep, playClick } from "@/lib/deck-audio";

let bridgeStarted = false;
let bridgeDispose: (() => void) | null = null;

function routeSignal(signal: DeckSignal): void {
  if (!isAudioAllowed()) return;
  if (signal.source === "ui") {
    if (signal.type === "select") {
      playClick();
      return;
    }
    if (signal.type === "cancel") {
      playBack();
      return;
    }
    return;
  }
  if (signal.source === "system" && signal.type === "mode_changed") {
    playBeep();
    return;
  }
}

/** Start the singleton audio bridge. Safe to call multiple times; idempotent. */
export function startDeckAudioBridge(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (bridgeStarted) {
    return bridgeDispose ?? (() => {});
  }
  bridgeStarted = true;
  bridgeDispose = subscribeSignals(routeSignal);
  return bridgeDispose;
}

/**
 * React hook that mounts the deck audio bridge for the lifetime of the host component.
 * Idempotent across remounts; the bridge persists for the page session.
 */
export function useDeckAudioBridge(): void {
  useEffect(() => {
    startDeckAudioBridge();
  }, []);
}
