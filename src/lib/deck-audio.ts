"use client";

const AUDIO_MUTED_KEY = "echo-mirage-audio-muted-v1";

let muted = true;
let context: AudioContext | null = null;
let humOscillator: OscillatorNode | null = null;
let humGain: GainNode | null = null;
let humLfo: OscillatorNode | null = null;
let humLfoGain: GainNode | null = null;
let hasLoadedMuteState = false;

function ensureMuteStateLoaded() {
  if (hasLoadedMuteState) return;
  hasLoadedMuteState = true;
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    muted = window.localStorage.getItem(AUDIO_MUTED_KEY) !== "0";
  } catch {
    muted = true;
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
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(hz, ctx.currentTime);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function playClick() {
  playTone("triangle", 1200, 20, 0.025);
}

export function playBack() {
  playTone("triangle", 700, 20, 0.03);
}

export function playBeep() {
  playTone("square", 880, 80, 0.03);
}

export function isMuted() {
  ensureMuteStateLoaded();
  return muted;
}

export function setMuted(nextMuted: boolean) {
  muted = nextMuted;
  persistMuted();
  if (muted) {
    if (humOscillator) {
      humOscillator.stop();
      humOscillator.disconnect();
      humOscillator = null;
    }
    if (humLfo) {
      humLfo.stop();
      humLfo.disconnect();
      humLfo = null;
    }
    humGain?.disconnect();
    humLfoGain?.disconnect();
    humGain = null;
    humLfoGain = null;
  } else {
    ensureContext();
  }
}

export function toggleAmbientHum() {
  if (isMuted()) return false;
  const ctx = ensureContext();
  if (!ctx) return false;
  if (humOscillator) {
    humOscillator.stop();
    humOscillator.disconnect();
    humOscillator = null;
    humLfo?.stop();
    humLfo?.disconnect();
    humLfo = null;
    humGain?.disconnect();
    humLfoGain?.disconnect();
    humGain = null;
    humLfoGain = null;
    return false;
  }
  humOscillator = ctx.createOscillator();
  humGain = ctx.createGain();
  humLfo = ctx.createOscillator();
  humLfoGain = ctx.createGain();
  humOscillator.type = "sine";
  humOscillator.frequency.setValueAtTime(80, ctx.currentTime);
  humGain.gain.setValueAtTime(0.02, ctx.currentTime);
  humLfo.type = "sine";
  humLfo.frequency.setValueAtTime(0.7, ctx.currentTime);
  humLfoGain.gain.setValueAtTime(2.5, ctx.currentTime);
  humLfo.connect(humLfoGain);
  humLfoGain.connect(humOscillator.frequency);
  humOscillator.connect(humGain);
  humGain.connect(ctx.destination);
  humOscillator.start();
  humLfo.start();
  return true;
}
