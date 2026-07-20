"use client";

/**
 * Module-level Mirage-device mic + Web Speech STT.
 * Shared by Mirage LISTENING tab and PowerFist Listen card when source = mirage.
 */

export const MIRAGE_LOCAL_LISTENING_CHANGED_EVENT =
  "echo-mirage-local-listening-changed";

export type MirageLocalListeningState = {
  active: boolean;
  interim: string;
  transcript: string;
  error: string | null;
  mediaRecorder: MediaRecorder | null;
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

const DEFAULT_STATE: MirageLocalListeningState = {
  active: false,
  interim: "",
  transcript: "",
  error: null,
  mediaRecorder: null,
};

let state: MirageLocalListeningState = { ...DEFAULT_STATE };
let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let recognition: SpeechRecognitionLike | null = null;
let wantListening = false;
let finals: string[] = [];

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

export function readMirageLocalListeningState(): MirageLocalListeningState {
  return {
    ...state,
    mediaRecorder: state.mediaRecorder,
  };
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

  const activeRecognition = recognition;
  recognition = null;
  if (activeRecognition) {
    try {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      activeRecognition.abort();
    } catch {
      try {
        activeRecognition.stop();
      } catch {
        /* ignore */
      }
    }
  }

  const activeRecorder = recorder;
  recorder = null;
  if (activeRecorder && activeRecorder.state !== "inactive") {
    try {
      activeRecorder.stop();
    } catch {
      /* ignore */
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
    mediaRecorder: null,
  });
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
  finals = [];
  setState({ transcript: "", interim: "", error: null, active: false, mediaRecorder: null });

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
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? `Microphone blocked: ${err.message}` : "Microphone permission denied.";
    wantListening = false;
    setState({ error: message });
    return { ok: false, message };
  }

  if (!wantListening) {
    for (const track of nextStream.getTracks()) track.stop();
    return { ok: false, message: "Listening cancelled." };
  }

  stream = nextStream;

  let nextRecorder: MediaRecorder;
  try {
    nextRecorder = new MediaRecorder(nextStream);
    nextRecorder.ondataavailable = () => undefined;
    nextRecorder.start(250);
  } catch (err) {
    for (const track of nextStream.getTracks()) track.stop();
    stream = null;
    wantListening = false;
    const message =
      err instanceof Error ? err.message : "Could not start MediaRecorder for visualizer.";
    setState({ error: message });
    return { ok: false, message };
  }

  recorder = nextRecorder;
  setState({ mediaRecorder: nextRecorder });

  const nextRecognition = new Ctor();
  recognition = nextRecognition;
  nextRecognition.continuous = true;
  nextRecognition.interimResults = true;
  nextRecognition.lang = "en-US";

  nextRecognition.onresult = (event) => {
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
    const code = event?.error || "speech-error";
    if (code === "aborted" || code === "no-speech") return;
    setState({ error: `Speech recognition error: ${code}` });
  };

  nextRecognition.onend = () => {
    if (!wantListening) return;
    window.setTimeout(() => {
      if (!wantListening || recognition !== nextRecognition) return;
      try {
        nextRecognition.start();
      } catch {
        /* restart race */
      }
    }, 120);
  };

  try {
    nextRecognition.start();
  } catch (err) {
    stopInternal();
    const message =
      err instanceof Error ? err.message : "Could not start speech recognition.";
    setState({ error: message });
    return { ok: false, message };
  }

  setState({ active: true, error: null });
  return {
    ok: true,
    message: "Mirage mic listening armed — live STT on this device.",
    keepArmed: true,
  };
}

export function stopMirageLocalListening(message = "Mirage listening stopped."): {
  ok: true;
  message: string;
} {
  stopInternal();
  return { ok: true, message };
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
