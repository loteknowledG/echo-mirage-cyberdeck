"use client";

import { useEffect, useState } from "react";

type UseAmbientTravelingWaveOptions = {
  slotCount: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  slotDurationMs?: number;
  enabled?: boolean;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Fires a traveling wave across slots every 30–60s (configurable).
 * Returns the currently highlighted slot index, or null between waves.
 */
export function useAmbientTravelingWave({
  slotCount,
  minIntervalMs = 30_000,
  maxIntervalMs = 60_000,
  slotDurationMs = 140,
  enabled = true,
}: UseAmbientTravelingWaveOptions): number | null {
  const [waveSlot, setWaveSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || slotCount <= 0) {
      setWaveSlot(null);
      return;
    }

    let cancelled = false;
    let waveTimer: number | null = null;
    let intervalTimer: number | null = null;

    const runWave = () => {
      if (cancelled) return;
      let slot = 0;

      const step = () => {
        if (cancelled) return;
        setWaveSlot(slot);
        slot += 1;
        if (slot < slotCount) {
          waveTimer = window.setTimeout(step, slotDurationMs);
        } else {
          waveTimer = window.setTimeout(() => setWaveSlot(null), slotDurationMs);
        }
      };

      step();
    };

    const scheduleNextWave = () => {
      if (cancelled) return;
      intervalTimer = window.setTimeout(() => {
        runWave();
        scheduleNextWave();
      }, randomBetween(minIntervalMs, maxIntervalMs));
    };

    const initialDelay = window.setTimeout(() => {
      runWave();
      scheduleNextWave();
    }, randomBetween(4000, 9000));

    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
      if (waveTimer !== null) window.clearTimeout(waveTimer);
      if (intervalTimer !== null) window.clearTimeout(intervalTimer);
      setWaveSlot(null);
    };
  }, [enabled, slotCount, minIntervalMs, maxIntervalMs, slotDurationMs]);

  return waveSlot;
}
