"use client";

import { useEffect } from "react";
import { bindSilentModeAudioGate } from "@/lib/electron/silent-mode";

/** Sync Electron Silent Mode with the central audio gate for the deck session. */
export function useSilentModeAudioGateSync(): void {
  useEffect(() => bindSilentModeAudioGate(), []);
}
