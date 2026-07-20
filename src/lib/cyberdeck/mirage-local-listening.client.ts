"use client";

/**
 * Module-level Mirage-device mic + Web Speech STT.
 * Shared by Mirage LISTENING tab and PowerFist Listen card when source = mirage.
 *
 * Note: do NOT attach MediaRecorder to the mic stream while starting Web Speech —
 * Chromium often needs a second Start before STT works if MediaRecorder owns the track first.
 */

export const MIRAGE_LOCAL_LISTENING_CHANGED_EVENT =
  "echo-mirage-local-listening-changed";

export type MirageLocalListeningState = {
  active: boolean;
  interim: string;
  transcript: string;
  error: string | null;
  /** Live mic stream for spectrum (no MediaRecorder). */
  mediaStream: MediaStream | null;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
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

const DEFAULT_STATE: MirageLocalListeningState = {
  active: false,
  interim: "",
  transcript: "",
  error: null,
  mediaStream: null,
};

const DEFAULT_LANG = "en-US";

let state: MirageLocalListeningState = { ...DEFAULT_STATE };
let stream: MediaStream | null = null;
let recognition: SpeechRecognitionLike | null = null;
let wantListening = false;
let finals: string[] = [];
let sessionGeneration = 0;
let receivedSpeechInSession = false;
let coldStartRestarts = 0;
let startDelayTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MIRAGE_LOCAL_LISTENING_CHANGED_EVENT, { detail: { ...state } }),
  );
}

function setState(patch: Partial<MirageLocalListeningState>) {
  state = { ...state, ...patch };
  emit();
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function clearStartDelay() {
  if (startDelayTimer == null) return;
  clearTimeout(startDelayTimer);
  startDelayTimer = null;
}

export function readMirageLocalListeningState(): MirageLocalListeningState {
  return { ...state, mediaStream: state.mediaStream };
}

export function isMirageLocalListeningActive(): boolean {
  return state.active;
}

export function subscribeMirageLocalListening(
  listener: (next: MirageLocalListeningState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener(readMirageLocalListeningState());
  window.addEventListener(MIRAGE_LOCAL_LISTENING_CHANGED_EVENT, handler);
  return () => window.removeEventListener(MIRAGE_LOCAL_LISTENING_CHANGED_EVENT, handler);
}

function stopInternal() {
  wantListening = false;
  sessionGeneration += 1;
  clearStartDelay();
  coldStartRestarts = 0;
  receivedSpeechInSession = false;

  const activeRecognition = recognition;
  recognition = null;
  if (activeRecognition) {
    try {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      activeRecognition.onstart = null;
      activeRecognition.abort();
    } catch {
      try {
        activeRecognition.stop();
      } catch {
        /* ignore */
      }
    }
  }

  if (stream) {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    }
    stream = null;
  }

  setState({
    active: false,
    interim: "",
    mediaStream: null,
  });
}

function waitForAudioTracks(nextStream: MediaStream): Promise<void> {
  const tracks = nextStream.getAudioTracks();
  if (tracks.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let remaining = tracks.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    for (const track of tracks) {
      if (track.readyState === "live") {
        done();
        continue;
      }
      const onLive = () => {
        track.removeEventListener("unmute", onLive);
        done();
      };
      track.addEventListener("unmute", onLive);
      // Fallback — some browsers never fire unmute.
      window.setTimeout(onLive, 250);
    }
  });
}

function attachRecognitionHandlers(nextRecognition: SpeechRecognitionLike, generation: number) {
  nextRecognition.onstart = () => {
    if (!wantListening || generation !== sessionGeneration) return;
    setState({ active: true, error: null });
  };

  nextRecognition.onresult = (event) => {
    if (!wantListening || generation !== sessionGeneration) return;
    receivedSpeechInSession = true;
    let interimText = "";
    let finalChunk = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (!text) continue;
      if (result.isFinal) finalChunk += `${text} `;
      else interimText += text;
    }
    if (finalChunk.trim()) {
      finals = [...finals, finalChunk.trim()];
      setState({ transcript: finals.join(" "), interim: "" });
    } else {
      setState({ interim: interimText });
    }
  };

  nextRecognition.onerror = (event) => {
    if (!wantListening || generation !== sessionGeneration) return;
    const code = event?.error || "speech-error";
    // Chromium often emits these during warm-up / restart; keep listening armed.
    if (code === "aborted" || code === "no-speech" || code === "network") return;
    setState({ error: `Speech recognition error: ${code}` });
  };

  nextRecognition.onend = () => {
    if (!wantListening || generation !== sessionGeneration) return;

    // First session often dies immediately before any speech — restart once.
    if (!receivedSpeechInSession && coldStartRestarts < 2) {
      coldStartRestarts += 1;
      window.setTimeout(() => {
        if (!wantListening || generation !== sessionGeneration) return;
        try {
          nextRecognition.start();
        } catch {
          void beginRecognition(generation);
        }
      }, 180);
      return;
    }

    window.setTimeout(() => {
      if (!wantListening || generation !== sessionGeneration) return;
      try {
        nextRecognition.start();
      } catch {
        void beginRecognition(generation);
      }
    }, 120);
  };
}

function beginRecognition(generation: number): void {
  if (!wantListening || generation !== sessionGeneration) return;
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    setState({ error: "Speech recognition unavailable — use Chrome/Edge." });
    return;
  }

  const previous = recognition;
  recognition = null;
  if (previous) {
    try {
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      previous.onstart = null;
      previous.abort();
    } catch {
      /* ignore */
    }
  }

  receivedSpeechInSession = false;
  const nextRecognition = new Ctor();
  recognition = nextRecognition;
  nextRecognition.continuous = true;
  nextRecognition.interimResults = true;
  nextRecognition.lang = DEFAULT_LANG;
  attachRecognitionHandlers(nextRecognition, generation);

  try {
    nextRecognition.start();
  } catch (err) {
    // "already started" / race — retry once shortly.
    window.setTimeout(() => {
      if (!wantListening || generation !== sessionGeneration) return;
      try {
        nextRecognition.start();
      } catch (retryErr) {
        const message =
          retryErr instanceof Error
            ? retryErr.message
            : err instanceof Error
              ? err.message
              : "Could not start speech recognition.";
        setState({ error: message, active: false });
      }
    }, 200);
  }
}

export async function startMirageLocalListening(): Promise<{
  ok: boolean;
  message: string;
  keepArmed?: boolean;
}> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Mirage listening requires a browser." };
  }

  stopInternal();
  wantListening = true;
  sessionGeneration += 1;
  const generation = sessionGeneration;
  finals = [];
  coldStartRestarts = 0;
  receivedSpeechInSession = false;
  setState({ transcript: "", interim: "", error: null, active: false, mediaStream: null });

  if (!navigator.mediaDevices?.getUserMedia) {
    const message = "Microphone API unavailable in this browser.";
    setState({ error: message });
    return { ok: false, message };
  }

  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    const message = "Speech recognition unavailable — use Chrome/Edge.";
    setState({ error: message });
    return { ok: false, message };
  }

  let nextStream: MediaStream;
  try {
    nextStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? `Microphone blocked: ${err.message}` : "Microphone permission denied.";
    wantListening = false;
    setState({ error: message });
    return { ok: false, message };
  }

  if (!wantListening || generation !== sessionGeneration) {
    for (const track of nextStream.getTracks()) track.stop();
    return { ok: false, message: "Listening cancelled." };
  }

  stream = nextStream;
  setState({ mediaStream: nextStream });

  await waitForAudioTracks(nextStream);
  if (!wantListening || generation !== sessionGeneration) {
    stopInternal();
    return { ok: false, message: "Listening cancelled." };
  }

  // Let the permission / track settle before SpeechRecognition grabs audio.
  await new Promise<void>((resolve) => {
    startDelayTimer = setTimeout(() => {
      startDelayTimer = null;
      resolve();
    }, 320);
  });

  if (!wantListening || generation !== sessionGeneration) {
    stopInternal();
    return { ok: false, message: "Listening cancelled." };
  }

  beginRecognition(generation);
  setState({ active: true, error: null });

  return {
    ok: true,
    message: "Mirage mic listening armed — live STT on this device.",
    keepArmed: true,
  };
}

export function stopMirageLocalListening(_message = "Mirage listening stopped."): {
  ok: true;
  message: string;
} {
  stopInternal();
  return { ok: true, message: "Mirage listening stopped." };
}

export function clearMirageLocalListeningTranscript(): { ok: true; message: string } {
  finals = [];
  setState({ transcript: "", interim: "", error: null });
  return { ok: true, message: "Mirage transcript cleared." };
}

export function mirageLocalListeningDisplayText(): string {
  const { transcript, interim } = state;
  return [transcript, interim].filter(Boolean).join(interim ? " … " : "").trim();
}
