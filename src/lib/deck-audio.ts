"use client";

const AUDIO_MUTED_KEY = "echo-mirage-audio-muted-v1";

let muted = false;
let context: AudioContext | null = null;
let hasLoadedMuteState = false;

function ensureMuteStateLoaded() {
  if (hasLoadedMuteState) return;
  hasLoadedMuteState = true;
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    const stored = window.localStorage.getItem(AUDIO_MUTED_KEY);
    if (stored === null) {
      muted = false;
      return;
    }
    muted = stored !== "0";
  } catch {
    muted = false;
  }
}

function persistMuted() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(AUDIO_MUTED_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function ensureContext() {
  ensureMuteStateLoaded();
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  if (!context) context = new AudioContext();
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

function playTone(type: OscillatorType, hz: number, durationMs: number, gainValue: number) {
  if (isMuted()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const fadeInMs = 8;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz, ctx.currentTime);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + fadeInMs / 1000);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function playClick() {
  if (isMuted()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.06);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

export function playBack() {
  playTone("triangle", 700, 30, 0.008);
}

export function playBeep() {
  playTone("square", 880, 80, 0.015);
}

export function isMuted() {
  ensureMuteStateLoaded();
  return muted;
}

export function setMuted(nextMuted: boolean) {
  muted = nextMuted;
  persistMuted();
  if (!muted) {
    ensureContext();
  }
}
