"use client";

import {
  readSurveyListeningPreferences,
  resolveMirageSpeechLang,
} from "@/lib/cyberdeck/survey-listening-preferences.client";
import {
  MIRAGE_LOCAL_LISTENING_CHANGED_EVENT,
  type MirageLocalListeningState,
} from "@/lib/cyberdeck/mirage-local-listening-shared.client";

const WHISPER_CHUNK_MS = 5_000;
const MIN_CHUNK_BYTES = 900;
const TRANSCRIBE_API_PATH = "/api/survey/transcribe";

let whisperActive = false;
let whisperStream: MediaStream | null = null;
let whisperRecorder: MediaRecorder | null = null;
let whisperGeneration = 0;
let whisperFinals: string[] = [];
let whisperTranscribeChain: Promise<void> = Promise.resolve();
let whisperState: MirageLocalListeningState = {
  active: false,
  interim: "",
  transcript: "",
  error: null,
  mediaStream: null,
};

function emitWhisperState() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MIRAGE_LOCAL_LISTENING_CHANGED_EVENT, {
      detail: { ...whisperState, mediaStream: whisperState.mediaStream },
    }),
  );
}

function setWhisperState(patch: Partial<MirageLocalListeningState>) {
  whisperState = { ...whisperState, ...patch };
  emitWhisperState();
}

function buildMicConstraints(): MediaTrackConstraints {
  const { micDeviceId, rawMic } = readSurveyListeningPreferences();
  const constraints: MediaTrackConstraints = {
    echoCancellation: !rawMic,
    noiseSuppression: !rawMic,
    autoGainControl: !rawMic,
  };
  if (micDeviceId) {
    constraints.deviceId = { exact: micDeviceId };
  }
  return constraints;
}

function pickRecorderMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

async function postWhisperChunk(blob: Blob, generation: number): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, blob.type.includes("webm") ? "chunk.webm" : "chunk.bin");
  form.append("lang", resolveMirageSpeechLang());

  const response = await fetch(TRANSCRIBE_API_PATH, {
    method: "POST",
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; text?: string; error?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Whisper HTTP ${response.status}`);
  }
  if (generation !== whisperGeneration || !whisperActive) return "";
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

function enqueueWhisperChunk(blob: Blob, generation: number) {
  if (blob.size < MIN_CHUNK_BYTES) return;
  whisperTranscribeChain = whisperTranscribeChain.then(async () => {
    if (!whisperActive || generation !== whisperGeneration) return;
    setWhisperState({ interim: "Whisper transcribing…" });
    try {
      const text = await postWhisperChunk(blob, generation);
      if (!text || generation !== whisperGeneration || !whisperActive) {
        setWhisperState({ interim: "" });
        return;
      }
      whisperFinals = [...whisperFinals, text];
      setWhisperState({ transcript: whisperFinals.join(" "), interim: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setWhisperState({ error: message, interim: "" });
    }
  });
}

export async function fetchMirageWhisperStatus(): Promise<{
  available: boolean;
  provider?: string;
  model?: string;
  error?: string;
}> {
  try {
    const response = await fetch(TRANSCRIBE_API_PATH, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | { available?: boolean; provider?: string; model?: string; error?: string }
      | null;
    return {
      available: Boolean(payload?.available),
      provider: payload?.provider,
      model: payload?.model,
      error: payload?.error,
    };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isMirageWhisperListeningActive(): boolean {
  return whisperActive;
}

export function readMirageWhisperListeningState(): MirageLocalListeningState {
  return { ...whisperState, mediaStream: whisperState.mediaStream };
}

export function stopMirageWhisperListening(): void {
  whisperActive = false;
  whisperGeneration += 1;
  whisperTranscribeChain = Promise.resolve();

  const recorder = whisperRecorder;
  whisperRecorder = null;
  if (recorder) {
    try {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignore */
    }
  }

  if (whisperStream) {
    for (const track of whisperStream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    }
    whisperStream = null;
  }

  setWhisperState({ active: false, interim: "", mediaStream: null });
}

export async function startMirageWhisperListening(): Promise<{
  ok: boolean;
  message: string;
  keepArmed?: boolean;
}> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Whisper listening requires a browser." };
  }

  const status = await fetchMirageWhisperStatus();
  if (!status.available) {
    const message =
      status.error ||
      "Whisper unavailable — set OPENAI_API_KEY on Vercel (Production env) and redeploy.";
    setWhisperState({ error: message, active: false });
    return { ok: false, message };
  }

  stopMirageWhisperListening();
  whisperActive = true;
  whisperGeneration += 1;
  const generation = whisperGeneration;
  whisperFinals = [];
  setWhisperState({ transcript: "", interim: "", error: null, active: false, mediaStream: null });

  if (!navigator.mediaDevices?.getUserMedia) {
    const message = "Microphone API unavailable in this browser.";
    whisperActive = false;
    setWhisperState({ error: message });
    return { ok: false, message };
  }

  if (typeof MediaRecorder === "undefined") {
    const message = "MediaRecorder unavailable — Whisper STT needs Chrome/Edge.";
    whisperActive = false;
    setWhisperState({ error: message });
    return { ok: false, message };
  }

  let nextStream: MediaStream;
  try {
    nextStream = await navigator.mediaDevices.getUserMedia({
      audio: buildMicConstraints(),
      video: false,
    });
  } catch (err) {
    whisperActive = false;
    const message =
      err instanceof Error ? `Microphone blocked: ${err.message}` : "Microphone permission denied.";
    setWhisperState({ error: message });
    return { ok: false, message };
  }

  if (!whisperActive || generation !== whisperGeneration) {
    for (const track of nextStream.getTracks()) track.stop();
    return { ok: false, message: "Listening cancelled." };
  }

  whisperStream = nextStream;
  setWhisperState({ mediaStream: nextStream, active: true, error: null });

  const mimeType = pickRecorderMimeType();
  const recorder = mimeType ? new MediaRecorder(nextStream, { mimeType }) : new MediaRecorder(nextStream);
  whisperRecorder = recorder;

  recorder.ondataavailable = (event) => {
    if (!whisperActive || generation !== whisperGeneration) return;
    if (event.data?.size) enqueueWhisperChunk(event.data, generation);
  };

  recorder.onerror = () => {
    if (!whisperActive || generation !== whisperGeneration) return;
    setWhisperState({ error: "MediaRecorder error during Whisper capture." });
  };

  try {
    recorder.start(WHISPER_CHUNK_MS);
  } catch (err) {
    stopMirageWhisperListening();
    const message = err instanceof Error ? err.message : "Could not start audio capture.";
    setWhisperState({ error: message });
    return { ok: false, message };
  }

  const providerLabel = status.provider === "openai" ? "OpenAI Whisper" : "Whisper (local)";
  return {
    ok: true,
    message: `Mirage Whisper listening — ${providerLabel}, ~${WHISPER_CHUNK_MS / 1000}s chunks.`,
    keepArmed: true,
  };
}

export function clearMirageWhisperTranscript(): void {
  whisperFinals = [];
  setWhisperState({ transcript: "", interim: "", error: null });
}
