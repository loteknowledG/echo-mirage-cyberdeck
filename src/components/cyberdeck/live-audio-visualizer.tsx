"use client";

import { useEffect, useRef } from "react";

type LiveAudioVisualizerProps = {
  /** Preferred — AnalyserNode from the live mic stream. */
  mediaStream?: MediaStream | null;
  /** Legacy react-audio-visualize-style prop. */
  mediaRecorder?: MediaRecorder | null;
  width?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  backgroundColor?: string;
  barColor?: string;
  fftSize?: number;
  maxDecibels?: number;
  minDecibels?: number;
  smoothingTimeConstant?: number;
};

/**
 * Live mic spectrum for Mirage Listening — uses MediaStream (no MediaRecorder required).
 */
export function LiveAudioVisualizer({
  mediaStream,
  mediaRecorder,
  width = 480,
  height = 72,
  barWidth = 3,
  gap = 2,
  backgroundColor = "#050807",
  barColor = "#34d399",
  fftSize = 256,
  maxDecibels = -10,
  minDecibels = -90,
  smoothingTimeConstant = 0.45,
}: LiveAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stream = mediaStream ?? mediaRecorder?.stream ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    let power = 32;
    const target = Math.max(32, Math.min(32768, fftSize));
    while (power < target && power < 32768) power *= 2;
    analyser.fftSize = power;
    analyser.maxDecibels = maxDecibels;
    analyser.minDecibels = minDecibels;
    analyser.smoothingTimeConstant = Math.max(0, Math.min(1, smoothingTimeConstant));
    source.connect(analyser);

    // Resume if browser started the context suspended (common on first gesture path).
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    const freq = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      analyser.getByteFrequencyData(freq);
      const barSlot = barWidth + gap;
      const barCount = Math.max(1, Math.floor(w / barSlot));
      const step = Math.max(1, Math.floor(freq.length / barCount));

      for (let i = 0; i < barCount; i += 1) {
        let sum = 0;
        const start = i * step;
        for (let j = start; j < start + step && j < freq.length; j += 1) {
          sum += freq[j] ?? 0;
        }
        const amp = sum / step / 255;
        const barH = Math.max(2, amp * (h - 4));
        const x = i * barSlot;
        const y = (h - barH) / 2;
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barH);
      }

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      void audioContext.close();
    };
  }, [
    stream,
    barWidth,
    gap,
    backgroundColor,
    barColor,
    fftSize,
    maxDecibels,
    minDecibels,
    smoothingTimeConstant,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height, display: "block", maxWidth: width }}
      data-testid="mirage-live-audio-visualizer"
      aria-hidden
    />
  );
}
