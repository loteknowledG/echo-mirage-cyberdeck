/**
 * Renderer-side STT for Echo Survey listening.
 * Prefers Whisper (Vercel cloud) — Chromium Web Speech is unreliable in Electron on macOS.
 */

import { fetchEchoWhisperAvailable, startWhisperStt, stopWhisperStt } from "./whisper-stt";

type SttReport = {
  interim?: string;
  final?: string;
  error?: string;
  listening?: boolean;
  level?: number;
  bands?: number[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SatelliteSttApi = {
  onSttStart: (handler: (payload?: { lang?: string }) => void) => () => void;
  onSttStop: (handler: (payload?: unknown) => void) => () => void;
  reportStt: (report: SttReport) => Promise<{ ok: boolean }>;
};

const BAND_COUNT = 16;

let recognition: SpeechRecognitionLike | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let meterRaf: number | null = null;
let wantListening = false;
let usingWhisper = false;
let uninstallStart: (() => void) | null = null;
let uninstallStop: (() => void) | null = null;
let lastLevelPushAt = 0;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function report(payload: SttReport) {
  const api = (window as Window & { satellite?: SatelliteSttApi }).satellite;
  void api?.reportStt?.(payload);
}

function isActive() {
  return wantListening;
}

function stopMeter() {
  if (meterRaf != null) {
    window.cancelAnimationFrame(meterRaf);
    meterRaf = null;
  }
  try {
    void audioContext?.close();
  } catch {
    /* ignore */
  }
  audioContext = null;
  analyser = null;
}

function stopMediaStream() {
  stopMeter();
  if (!mediaStream) return;
  for (const track of mediaStream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
  mediaStream = null;
}

function stopWebSpeech() {
  const active = recognition;
  recognition = null;
  if (!active) return;
  try {
    active.onresult = null;
    active.onerror = null;
    active.onend = null;
    active.abort();
  } catch {
    try {
      active.stop();
    } catch {
      /* ignore */
    }
  }
}

function stopListening() {
  wantListening = false;
  usingWhisper = false;
  stopWhisperStt();
  stopWebSpeech();
  stopMediaStream();
  report({ listening: false, interim: "", level: 0, bands: [] });
}

function startMeter(stream: MediaStream) {
  stopMeter();
  try {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext = new Ctx();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
  } catch {
    return;
  }

  const time = new Uint8Array(analyser!.fftSize);
  const freq = new Uint8Array(analyser!.frequencyBinCount);

  const tick = () => {
    if (!analyser || !wantListening) return;
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i += 1) {
      const v = (time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / time.length);
    const level = Math.max(0, Math.min(1, rms * 3.2));

    analyser.getByteFrequencyData(freq);
    const bands: number[] = [];
    const step = Math.max(1, Math.floor(freq.length / BAND_COUNT));
    for (let i = 0; i < BAND_COUNT; i += 1) {
      let acc = 0;
      const start = i * step;
      for (let j = start; j < start + step && j < freq.length; j += 1) {
        acc += freq[j] ?? 0;
      }
      bands.push(Math.max(0, Math.min(1, acc / step / 255)));
    }

    const now = Date.now();
    if (now - lastLevelPushAt >= 90) {
      lastLevelPushAt = now;
      report({ level, bands, listening: true });
    }

    meterRaf = window.requestAnimationFrame(tick);
  };

  meterRaf = window.requestAnimationFrame(tick);
}

async function ensureMicrophone(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    report({
      listening: false,
      error: "Microphone API unavailable in this Electron build.",
    });
    return null;
  }
  try {
    stopMediaStream();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    startMeter(mediaStream);
    return mediaStream;
  } catch (error) {
    report({
      listening: false,
      error:
        error instanceof Error
          ? `Microphone blocked: ${error.message}`
          : "Microphone permission denied.",
    });
    return null;
  }
}

async function startWebSpeech(lang: string, stream: MediaStream) {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    report({
      listening: false,
      error:
        "Chromium speech unavailable — ensure OPENAI_API_KEY is set on Vercel for Whisper STT.",
    });
    return;
  }

  stopWebSpeech();
  const next = new Ctor();
  recognition = next;
  next.continuous = true;
  next.interimResults = true;
  next.lang = lang || "en-US";

  next.onresult = (event) => {
    let interim = "";
    let finalChunk = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (!text) continue;
      if (result.isFinal) finalChunk += `${text} `;
      else interim += text;
    }
    if (finalChunk.trim()) {
      report({ final: finalChunk.trim(), interim: "" });
    } else if (interim) {
      report({ interim });
    }
  };

  next.onerror = (event) => {
    const code = event?.error || "speech-error";
    if (code === "aborted" || code === "no-speech") return;
    if (code === "network") {
      void switchToWhisper(lang, stream);
      return;
    }
    report({
      error:
        code === "not-allowed"
          ? "Speech blocked — grant Microphone in System Settings."
          : `Speech recognition error: ${code}`,
    });
  };

  next.onend = () => {
    if (!wantListening || usingWhisper) return;
    window.setTimeout(() => {
      if (!wantListening || usingWhisper || recognition !== next) return;
      try {
        next.start();
      } catch {
        void switchToWhisper(lang, stream);
      }
    }, 120);
  };

  try {
    next.start();
    report({ listening: true, interim: "", error: undefined });
  } catch {
    void switchToWhisper(lang, stream);
  }
}

async function switchToWhisper(lang: string, stream: MediaStream) {
  stopWebSpeech();
  const whisperOk = await fetchEchoWhisperAvailable();
  if (!whisperOk || !wantListening) {
    report({
      listening: false,
      error:
        "Chromium speech failed and Whisper is unavailable — set OPENAI_API_KEY on Vercel, keep Echo Satellite online, then retry.",
    });
    return;
  }
  usingWhisper = true;
  startWhisperStt(stream, lang, report, isActive);
}

async function startListening(lang = "en-US") {
  stopListening();
  wantListening = true;

  const stream = await ensureMicrophone();
  if (!stream || !wantListening) {
    wantListening = false;
    return;
  }

  const whisperOk = await fetchEchoWhisperAvailable();
  if (whisperOk) {
    usingWhisper = true;
    startWhisperStt(stream, lang, report, isActive);
    return;
  }

  usingWhisper = false;
  await startWebSpeech(lang, stream);
}

/** Install STT IPC listeners once the Echo Satellite UI loads. */
export function installEchoSttBridge(): () => void {
  const api = (window as Window & { satellite?: SatelliteSttApi }).satellite;
  if (!api?.onSttStart || !api?.onSttStop) {
    return () => undefined;
  }
  uninstallStart?.();
  uninstallStop?.();
  uninstallStart = api.onSttStart((payload) => {
    void startListening(payload?.lang || "en-US");
  });
  uninstallStop = api.onSttStop(() => {
    stopListening();
  });
  return () => {
    uninstallStart?.();
    uninstallStop?.();
    uninstallStart = null;
    uninstallStop = null;
    stopListening();
  };
}
