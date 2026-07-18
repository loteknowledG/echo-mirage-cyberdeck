/**
 * Echo Survey listening / Web Speech bridge.
 * Main process owns state; renderer runs SpeechRecognition and reports via IPC.
 */

import * as logger from "./logger.mjs";
import { pushListeningEvent } from "./survey-relay-client.mjs";

/** @typedef {{ text: string, at: string, seq: number }} ListeningFinal */

/**
 * @type {{
 *   listening: boolean,
 *   recordingStartedAt: number | null,
 *   seq: number,
 *   interim: string,
 *   lastFinal: string,
 *   finals: ListeningFinal[],
 *   error: string | null,
 * }}
 */
const audioState = {
  listening: false,
  recordingStartedAt: null,
  seq: 0,
  interim: "",
  lastFinal: "",
  finals: [],
  error: null,
};

/** @type {{
 *   sendToRenderer?: (channel: string, payload?: object) => void,
 *   getEchoNodeId?: () => string | null,
 *   askMicrophoneAccess?: () => Promise<boolean>,
 * } | null} */
let hooks = null;

const MAX_FINALS = 12;
let lastInterimPushAt = 0;

/**
 * @param {{
 *   sendToRenderer?: (channel: string, payload?: object) => void,
 *   getEchoNodeId?: () => string | null,
 *   askMicrophoneAccess?: () => Promise<boolean>,
 * }} next
 */
export function configureEchoListeningHooks(next) {
  hooks = next;
}

export function readEchoListeningState() {
  return {
    listening: audioState.listening,
    recordingStartedAt: audioState.recordingStartedAt,
    seq: audioState.seq,
    interim: audioState.interim,
    lastFinal: audioState.lastFinal,
    finals: audioState.finals.slice(-MAX_FINALS),
    error: audioState.error,
  };
}

function echoNodeId() {
  return hooks?.getEchoNodeId?.()?.trim() || null;
}

/**
 * @param {{ kind: "started" | "stopped" | "partial" | "final" | "error", text?: string, error?: string }} event
 */
async function emitListeningEvent(event) {
  const id = echoNodeId();
  if (!id) return;
  const snapshot = readEchoListeningState();
  void pushListeningEvent({
    echoNodeId: id,
    kind: event.kind,
    listening: snapshot.listening,
    interim: snapshot.interim,
    final: event.kind === "final" ? event.text ?? snapshot.lastFinal : undefined,
    text: event.text,
    seq: snapshot.seq,
    error: event.error ?? snapshot.error,
    finals: snapshot.finals,
  });
}

/**
 * Renderer → main STT update.
 * @param {{ interim?: string, final?: string, error?: string, listening?: boolean }} report
 */
export function applySttReport(report) {
  if (typeof report.listening === "boolean") {
    audioState.listening = report.listening;
  }
  if (typeof report.error === "string" && report.error.trim()) {
    audioState.error = report.error.trim();
    void emitListeningEvent({ kind: "error", error: audioState.error });
  }
  if (typeof report.interim === "string") {
    audioState.interim = report.interim;
    const now = Date.now();
    if (now - lastInterimPushAt >= 150) {
      lastInterimPushAt = now;
      audioState.seq += 1;
      void emitListeningEvent({ kind: "partial", text: audioState.interim });
    }
  }
  if (typeof report.final === "string" && report.final.trim()) {
    const text = report.final.trim();
    audioState.seq += 1;
    audioState.lastFinal = text;
    audioState.interim = "";
    audioState.finals.push({
      text,
      at: new Date().toISOString(),
      seq: audioState.seq,
    });
    if (audioState.finals.length > MAX_FINALS) {
      audioState.finals = audioState.finals.slice(-MAX_FINALS);
    }
    void emitListeningEvent({ kind: "final", text });
  }
}

export async function startEchoListening() {
  if (audioState.listening) {
    return { ok: true, listening: true, message: "Already listening on Echo." };
  }

  if (hooks?.askMicrophoneAccess) {
    const granted = await hooks.askMicrophoneAccess();
    if (!granted) {
      audioState.error = "Microphone permission denied.";
      return {
        ok: false,
        reason: "Microphone permission denied — grant mic access for Echo Satellite.",
        listening: false,
      };
    }
  }

  audioState.listening = true;
  audioState.recordingStartedAt = Date.now();
  audioState.interim = "";
  audioState.error = null;
  audioState.seq += 1;

  hooks?.sendToRenderer?.("satellite:stt-start", { lang: "en-US" });
  logger.log("echo-command: start-listening (STT armed)");
  void emitListeningEvent({ kind: "started" });

  return {
    ok: true,
    listening: true,
    message: "Echo listening armed — live speech-to-text active.",
  };
}

export function stopEchoListening() {
  if (!audioState.listening) {
    return { ok: true, listening: false, message: "Echo was not listening." };
  }
  audioState.listening = false;
  audioState.interim = "";
  hooks?.sendToRenderer?.("satellite:stt-stop", {});
  logger.log("echo-command: stop-listening");
  void emitListeningEvent({ kind: "stopped" });
  return {
    ok: true,
    listening: false,
    message: "Echo listening stopped.",
  };
}

/** @param {import("electron").App | undefined} app */
export function saveEchoListeningReceipt(app) {
  if (!audioState.recordingStartedAt && audioState.finals.length === 0) {
    return { ok: false, reason: "No Echo listening session — start listening first." };
  }
  const durationMs = audioState.recordingStartedAt
    ? Date.now() - audioState.recordingStartedAt
    : 0;
  const transcript = audioState.finals.map((f) => f.text).join(" ").trim();
  audioState.listening = false;
  audioState.recordingStartedAt = null;
  audioState.interim = "";
  hooks?.sendToRenderer?.("satellite:stt-stop", {});
  void emitListeningEvent({ kind: "stopped" });
  logger.log(`echo-command: save-recording (${durationMs}ms, ${transcript.length} chars)`);
  return {
    ok: true,
    message: transcript
      ? `Listening receipt saved (${Math.round(durationMs / 1000)}s, ${transcript.length} chars).`
      : `Listening receipt saved (${Math.round(durationMs / 1000)}s — no finals yet).`,
    durationMs,
    transcript,
    userData: app?.getPath?.("userData") ?? null,
  };
}
