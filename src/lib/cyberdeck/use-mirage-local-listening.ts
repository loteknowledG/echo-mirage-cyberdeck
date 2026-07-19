"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export type MirageLocalListeningState = {
  active: boolean;
  interim: string;
  transcript: string;
  error: string | null;
  mediaRecorder: MediaRecorder | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Mirage-local mic capture: MediaRecorder (for LiveAudioVisualizer) + continuous Web Speech STT.
 */
export function useMirageLocalListening() {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const finalsRef = useRef<string[]>([]);

  const stopAll = useCallback(() => {
    wantListeningRef.current = false;

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
    }

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }

    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
    }

    setMediaRecorder(null);
    setActive(false);
    setInterim("");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    stopAll();
    wantListeningRef.current = true;
    finalsRef.current = [];
    setTranscript("");
    setInterim("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API unavailable in this browser.");
      return { ok: false as const, message: "Microphone API unavailable." };
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition unavailable — use Chrome/Edge.");
      return { ok: false as const, message: "Speech recognition unavailable." };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? `Microphone blocked: ${err.message}` : "Microphone permission denied.";
      setError(message);
      wantListeningRef.current = false;
      return { ok: false as const, message };
    }

    if (!wantListeningRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return { ok: false as const, message: "Listening cancelled." };
    }

    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
      // Discard chunks — we only need the live stream for visualization + STT.
      recorder.ondataavailable = () => undefined;
      recorder.start(250);
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
      const message =
        err instanceof Error ? err.message : "Could not start MediaRecorder for visualizer.";
      setError(message);
      wantListeningRef.current = false;
      return { ok: false as const, message };
    }

    recorderRef.current = recorder;
    setMediaRecorder(recorder);

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
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
        finalsRef.current = [...finalsRef.current, finalChunk.trim()];
        setTranscript(finalsRef.current.join(" "));
        setInterim("");
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || "speech-error";
      if (code === "aborted" || code === "no-speech") return;
      setError(`Speech recognition error: ${code}`);
    };

    recognition.onend = () => {
      if (!wantListeningRef.current) return;
      window.setTimeout(() => {
        if (!wantListeningRef.current || recognitionRef.current !== recognition) return;
        try {
          recognition.start();
        } catch {
          /* restart race */
        }
      }, 120);
    };

    try {
      recognition.start();
    } catch (err) {
      stopAll();
      const message =
        err instanceof Error ? err.message : "Could not start speech recognition.";
      setError(message);
      return { ok: false as const, message };
    }

    setActive(true);
    return { ok: true as const, message: "Listening — mic + STT armed." };
  }, [stopAll]);

  const stop = useCallback(() => {
    stopAll();
    return { ok: true as const, message: "Listening stopped." };
  }, [stopAll]);

  const clearTranscript = useCallback(() => {
    finalsRef.current = [];
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  return {
    active,
    interim,
    transcript,
    error,
    mediaRecorder,
    start,
    stop,
    clearTranscript,
    displayText: [transcript, interim].filter(Boolean).join(interim ? " … " : "").trim(),
  };
}
