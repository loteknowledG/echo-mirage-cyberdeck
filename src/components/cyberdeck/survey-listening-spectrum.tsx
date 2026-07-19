"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 24;

type SurveyListeningSpectrumProps = {
  /** 0–1 mic level from Echo, or null when idle. */
  level: number | null;
  /** Optional FFT bands 0–1 from Echo analyser. */
  bands?: number[] | null;
  active: boolean;
};

/** Volume-modulation spectrum for the PowerFist Listen armed card. */
export function SurveyListeningSpectrum({ level, bands, active }: SurveyListeningSpectrumProps) {
  const historyRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0.04));
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(level);
  const bandsRef = useRef(bands);
  const activeRef = useRef(active);
  levelRef.current = level;
  bandsRef.current = bands;
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const live = activeRef.current;
      const rawBands = bandsRef.current;
      const nextLevel = Math.max(0, Math.min(1, levelRef.current ?? 0));

      let bars: number[];
      if (live && Array.isArray(rawBands) && rawBands.length > 0) {
        bars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const src = rawBands[Math.floor((i / BAR_COUNT) * rawBands.length)] ?? 0;
          return Math.max(0.04, Math.min(1, src));
        });
      } else {
        const history = historyRef.current;
        if (live) {
          const jitter = live ? (Math.random() - 0.5) * 0.08 * (0.35 + nextLevel) : 0;
          history.push(Math.max(0.04, Math.min(1, nextLevel * 0.85 + jitter + nextLevel * 0.2)));
          if (history.length > BAR_COUNT) history.shift();
        } else {
          for (let i = 0; i < history.length; i += 1) {
            history[i] *= 0.88;
            if (history[i] < 0.04) history[i] = 0.04;
          }
        }
        bars = history.slice(-BAR_COUNT);
      }

      const gap = 2;
      const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const amp = bars[i] ?? 0.04;
        const barH = Math.max(2, amp * (h - 4));
        const x = i * (barW + gap);
        const y = h - barH;
        const hot = amp > 0.55;
        ctx.fillStyle = !live
          ? "rgba(80, 100, 90, 0.35)"
          : hot
            ? "rgba(52, 211, 153, 0.95)"
            : "rgba(110, 231, 183, 0.7)";
        ctx.fillRect(x, y, barW, barH);
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="survey-listening-spectrum"
      width={320}
      height={64}
      data-testid="survey-listening-spectrum"
      aria-hidden
    />
  );
}
