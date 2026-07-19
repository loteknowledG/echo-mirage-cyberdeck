"use client";

import { useEffect, useState } from "react";
import { ensureSurveyRelayEchoNodeId, fetchSurveyRelayListening } from "@/lib/cyberdeck/survey-relay.client";
import { solveMirageSelectedTextAsync } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { appendSurveyChatMessage } from "@/lib/cyberdeck/survey-chat";
import { isSurveyHttpsPairBlocked } from "@/lib/cyberdeck/survey-pairing-shared.client";
import {
  DEFAULT_ECHO_HTTP_PORT,
  preferMeshEchoHost,
} from "@/lib/cyberdeck/survey-pair-pin";
import { readSurveyMiragePairCredentials } from "@/lib/cyberdeck/survey-pairing-client";
import { readSurveyPairPinDraft } from "@/lib/cyberdeck/survey-pair-pin-draft";

export const SURVEY_LISTENING_CHANGED_EVENT = "echo-mirage-survey-listening-changed";

export type SurveyListeningClientState = {
  armed: boolean;
  listening: boolean;
  interim: string;
  lastFinal: string;
  lastSuggestText: string;
  lastSuggestAnswer: string;
  error: string | null;
  banner: string | null;
  seq: number;
  updatedAt: string | null;
  /** 0–1 mic level from Echo (volume modulation). */
  level: number;
  /** Optional analyser bands 0–1. */
  bands: number[];
};

const DEFAULT_STATE: SurveyListeningClientState = {
  armed: false,
  listening: false,
  interim: "",
  lastFinal: "",
  lastSuggestText: "",
  lastSuggestAnswer: "",
  error: null,
  banner: null,
  seq: 0,
  updatedAt: null,
  level: 0,
  bands: [],
};

let state: SurveyListeningClientState = { ...DEFAULT_STATE };
let pollTimer: number | null = null;
let suggestInFlight = false;
let lastHandledFinalSeq = 0;
let lastSuggestAt = 0;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_LISTENING_CHANGED_EVENT, { detail: { ...state } }));
}

function setState(patch: Partial<SurveyListeningClientState>) {
  state = { ...state, ...patch };
  emit();
}

export function readSurveyListeningState(): SurveyListeningClientState {
  return { ...state };
}

export function subscribeSurveyListening(listener: (next: SurveyListeningClientState) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener(readSurveyListeningState());
  window.addEventListener(SURVEY_LISTENING_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SURVEY_LISTENING_CHANGED_EVENT, handler);
}

async function fetchLanListeningSnapshot(): Promise<{
  ok: boolean;
  listening?: boolean;
  interim?: string;
  lastFinal?: string;
  seq?: number;
  error?: string | null;
  level?: number;
  bands?: number[];
  finals?: Array<{ text: string; at: string; seq: number }>;
  reason?: string;
} | null> {
  if (isSurveyHttpsPairBlocked()) return null;
  const mirage = readSurveyMiragePairCredentials();
  const draft = readSurveyPairPinDraft("mirage");
  const hostRaw = mirage?.echoHost?.trim() || draft?.echoHost?.trim() || null;
  const host = preferMeshEchoHost(hostRaw) ?? hostRaw;
  if (!host) return null;
  const port =
    mirage?.httpPort ||
    Number(draft?.echoHttpPort?.trim()) ||
    DEFAULT_ECHO_HTTP_PORT;
  try {
    const res = await fetch(`http://${host}:${port}/api/survey/echo/listening`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      listening?: boolean;
      interim?: string;
      lastFinal?: string;
      seq?: number;
      error?: string | null;
      level?: number;
      bands?: number[];
      finals?: Array<{ text: string; at: string; seq: number }>;
      reason?: string;
    };
    if (!res.ok || payload.ok === false) return { ok: false, reason: payload.reason ?? `HTTP ${res.status}` };
    return { ok: true, ...payload };
  } catch {
    return null;
  }
}

async function maybeSuggestFromFinal(text: string, seq: number) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (seq <= lastHandledFinalSeq) return;
  if (suggestInFlight) return;
  // Debounce overlapping finals within 1.2s of last suggest of same/adjacent speech.
  if (Date.now() - lastSuggestAt < 1200 && trimmed === state.lastSuggestText) return;

  const looksLikeQuestion = /[?]/.test(trimmed) || trimmed.split(/\s+/).length >= 4;
  if (!looksLikeQuestion) {
    lastHandledFinalSeq = seq;
    return;
  }

  lastHandledFinalSeq = seq;
  suggestInFlight = true;
  lastSuggestAt = Date.now();
  setState({ banner: "SUGGEST // analyzing interviewer question…" });
  appendSurveyChatMessage({
    role: "system",
    text: `SURVEY // LISTENING FINAL // ${trimmed.slice(0, 160)}${trimmed.length > 160 ? "…" : ""}`,
  });

  try {
    const result = await solveMirageSelectedTextAsync(trimmed);
    if (result.ok) {
      setState({
        lastSuggestText: trimmed,
        lastSuggestAnswer: result.answerText ?? "",
        banner: "SUGGEST // answer ready",
        error: null,
      });
    } else {
      setState({
        banner: null,
        error: result.message || "Suggest failed.",
      });
    }
  } catch (error) {
    setState({
      banner: null,
      error: error instanceof Error ? error.message : "Suggest failed.",
    });
  } finally {
    suggestInFlight = false;
  }
}

async function pollOnce() {
  if (!state.armed) return;

  const resolved = await ensureSurveyRelayEchoNodeId(
    readSurveyMiragePairCredentials()?.echoNodeId,
  );
  const echoNodeId = resolved.ok ? resolved.echoNodeId : "";

  const relay = await fetchSurveyRelayListening(echoNodeId || undefined);
  const lan = relay.ok ? null : await fetchLanListeningSnapshot();
  const snapshot = relay.ok
    ? {
        listening: relay.listening.listening,
        interim: relay.listening.interim,
        lastFinal: relay.listening.lastFinal,
        seq: relay.listening.seq,
        error: relay.listening.error,
        finals: relay.listening.finals,
        updatedAt: relay.listening.updatedAt,
        level: relay.listening.level ?? 0,
        bands: relay.listening.bands ?? [],
      }
    : lan?.ok
      ? {
          listening: !!lan.listening,
          interim: lan.interim ?? "",
          lastFinal: lan.lastFinal ?? "",
          seq: lan.seq ?? 0,
          error: lan.error ?? null,
          finals: lan.finals ?? [],
          updatedAt: new Date().toISOString(),
          level: typeof lan.level === "number" ? lan.level : 0,
          bands: Array.isArray(lan.bands) ? lan.bands : [],
        }
      : null;

  if (!snapshot) {
    setState({
      banner: state.listening ? null : "Waiting for Echo listening snapshot (relay / LAN)…",
      error: relay.ok === false ? relay.reason : lan?.reason ?? state.error,
    });
    return;
  }

  setState({
    listening: snapshot.listening,
    interim: snapshot.interim,
    lastFinal: snapshot.lastFinal,
    seq: snapshot.seq,
    error: snapshot.error,
    updatedAt: snapshot.updatedAt,
    level: snapshot.level,
    bands: snapshot.bands,
    banner: snapshot.listening
      ? snapshot.interim
        ? "LISTENING // interim…"
        : "LISTENING // armed"
      : state.armed
        ? "ARMED // Echo not reporting live speech yet"
        : null,
  });

  const latestFinal = snapshot.finals?.length
    ? snapshot.finals[snapshot.finals.length - 1]
    : snapshot.lastFinal
      ? { text: snapshot.lastFinal, seq: snapshot.seq, at: snapshot.updatedAt }
      : null;
  if (latestFinal?.text) {
    void maybeSuggestFromFinal(latestFinal.text, latestFinal.seq);
  }
}

function clearPollTimer() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Start Mirage-side poll after Echo Start Listening succeeds. */
export function armSurveyListeningPost(message?: string) {
  setState({
    armed: true,
    listening: true,
    error: null,
    banner: message ?? "ARMED // polling Echo transcript…",
  });
  clearPollTimer();
  void pollOnce();
  pollTimer = window.setInterval(() => {
    void pollOnce();
  }, 300);
}

/** Stop Mirage poll after Echo Stop Listening. */
export function disarmSurveyListeningPost(message?: string) {
  clearPollTimer();
  setState({
    armed: false,
    listening: false,
    interim: "",
    level: 0,
    bands: [],
    banner: message ?? "Listening stopped.",
  });
}

export function noteSurveyListeningCommandFailure(reason: string) {
  setState({
    error: reason,
    banner: null,
  });
}

export function isSurveyListeningArmed(): boolean {
  return state.armed || state.listening;
}

/** Clear transcript / suggest buffers without stopping Echo (Clear card). */
export function clearSurveyListeningTranscript(): { ok: true; message: string } {
  lastHandledFinalSeq = state.seq;
  setState({
    interim: "",
    lastFinal: "",
    lastSuggestText: "",
    lastSuggestAnswer: "",
    error: null,
    banner: state.armed || state.listening ? "LISTENING // cleared" : "Listening post cleared.",
  });
  return { ok: true, message: "Listening transcript cleared." };
}

/** SOLVE against the latest listening final (or interim fallback). */
export async function solveSurveyListeningTranscript(): Promise<{
  ok: boolean;
  message: string;
  answerText?: string;
}> {
  const text = (state.lastFinal || state.interim || state.lastSuggestText).trim();
  if (!text) {
    return { ok: false, message: "No listening transcript to solve yet." };
  }
  setState({ banner: "SOLVE // listening transcript…" });
  const result = await solveMirageSelectedTextAsync(text);
  if (result.ok) {
    setState({
      lastSuggestText: text,
      lastSuggestAnswer: result.answerText ?? "",
      banner: "SOLVE // answer ready",
      error: null,
    });
  } else {
    setState({ banner: null, error: result.message });
  }
  return result;
}

export function useSurveyListeningStatus(): SurveyListeningClientState {
  const [snapshot, setSnapshot] = useState<SurveyListeningClientState>(() =>
    readSurveyListeningState(),
  );

  useEffect(() => subscribeSurveyListening(setSnapshot), []);

  return snapshot;
}
