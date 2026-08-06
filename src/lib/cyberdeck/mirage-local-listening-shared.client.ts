"use client";

export const MIRAGE_LOCAL_LISTENING_CHANGED_EVENT =
  "echo-mirage-local-listening-changed";

export type MirageLocalListeningState = {
  active: boolean;
  interim: string;
  transcript: string;
  error: string | null;
  /** Live mic stream for spectrum (no MediaRecorder on web-speech path). */
  mediaStream: MediaStream | null;
};

export type SurveyMirageSttEngine = "whisper" | "web-speech";
