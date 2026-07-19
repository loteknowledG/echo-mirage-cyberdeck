/**
 * Renderer-side continuous Web Speech STT for Echo Survey listening.
 * Driven by main-process satellite:stt-start / satellite:stt-stop IPC.
 * Also meters mic volume for PowerFist Listen spectrum.
 */

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

function stopRecognition() {
  wantListening = false;
  const active = recognition;
  recognition = null;
  stopMediaStream();
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

  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);

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

async function ensureMicrophone(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    // Fall through — Web Speech may still open the mic itself.
    return true;
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
    return true;
  } catch (error) {
    report({
      listening: false,
      error:
        error instanceof Error
          ? `Microphone blocked: ${error.message}`
          : "Microphone permission denied.",
    });
    return false;
  }
}

async function startRecognition(lang = "en-US") {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    report({
      listening: false,
      error: "Speech recognition unavailable in this Chromium build (needs network speech).",
    });
    return;
  }

  stopRecognition();
  wantListening = true;

  const micOk = await ensureMicrophone();
  if (!micOk || !wantListening) {
    wantListening = false;
    return;
  }

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
    report({ error: `Speech recognition error: ${code}` });
  };

  next.onend = () => {
    if (!wantListening) return;
    // Chromium often ends continuous sessions — restart while armed.
    window.setTimeout(() => {
      if (!wantListening || recognition !== next) return;
      try {
        next.start();
      } catch {
        void startRecognition(lang);
      }
    }, 120);
  };

  try {
    next.start();
    report({ listening: true, interim: "", error: undefined });
  } catch (error) {
    wantListening = false;
    recognition = null;
    stopMediaStream();
    report({
      listening: false,
      error: error instanceof Error ? error.message : "Could not start speech recognition.",
    });
  }
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
    void startRecognition(payload?.lang || "en-US");
  });
  uninstallStop = api.onSttStop(() => {
    stopRecognition();
  });
  return () => {
    uninstallStart?.();
    uninstallStop?.();
    uninstallStart = null;
    uninstallStop = null;
    stopRecognition();
  };
}
