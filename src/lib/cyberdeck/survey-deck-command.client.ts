"use client";

import {
  SURVEY_ECHO_COMMAND,
  SURVEY_MIRAGE_COMMAND,
  type SurveyDeckCommandId,
} from "@/lib/cyberdeck/survey-deck-data";
import {
  answerCurrentMirageItemAsync,
  applyMirageQueueControl,
  displayCurrentMirageItem,
  ingestMirageQueueItem,
  runMirageSpeechToTextItem,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { SURVEY_SILENT_CAPTURE_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";

export const SURVEY_LAST_CAPTURE_STORAGE_KEY = "echo-mirage-survey-last-capture-v1";
export const SURVEY_LAST_CAPTURE_EVENT = "echo-mirage-survey-last-capture";

export type SurveyDeckCommandResult = {
  ok: boolean;
  message: string;
  pngBase64?: string;
};

export type SurveyDeckCommandContext = {
  echoHost: string | null;
  echoHttpPort: number;
};

/** Resolve Echo Satellite endpoint for deck commands (team probe + saved pair creds). */
export function resolveSurveyEchoDeckContext(
  teamEchoHost?: string | null,
): SurveyDeckCommandContext {
  const mirageCreds = readSurveyMiragePairCredentials();
  const powerfistCreds = readSurveyPowerfistPairCredentials();
  let echoHost =
    teamEchoHost?.trim() ||
    mirageCreds?.echoHost?.trim() ||
    powerfistCreds?.echoHost?.trim() ||
    null;
  const echoHttpPort =
    mirageCreds?.httpPort ?? powerfistCreds?.httpPort ?? DEFAULT_ECHO_HTTP_PORT;

  // One-machine dev (EMP ignition): loopback Echo before pair creds land in localStorage.
  if (!echoHost && typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      echoHost = "127.0.0.1";
    }
  }

  return { echoHost, echoHttpPort };
}

function logDeck(line: string): void {
  notifySurveyMuthurArchive(`SURVEY DECK // ${line}`);
}

function storeLastCapture(pngBase64: string): void {
  if (typeof window === "undefined") return;
  const payload = { pngBase64, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(SURVEY_LAST_CAPTURE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(SURVEY_LAST_CAPTURE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(SURVEY_LAST_CAPTURE_EVENT, {
      detail: { pngBase64 },
    }),
  );
  ingestMirageQueueItem({
    title: "Echo capture",
    prompt: SURVEY_SILENT_CAPTURE_PROMPT,
    imageDataUrl: `data:image/png;base64,${pngBase64}`,
    source: "capture",
  });
}

export function readLastSurveyCapture(): { pngBase64: string; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(SURVEY_LAST_CAPTURE_STORAGE_KEY) ??
      window.sessionStorage.getItem(SURVEY_LAST_CAPTURE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pngBase64?: string; at?: string };
    if (!parsed.pngBase64?.trim()) return null;
    return { pngBase64: parsed.pngBase64, at: parsed.at ?? "" };
  } catch {
    return null;
  }
}

/** Echo deck screenshot — usable from Mirage or PowerFist. */
export async function takeSurveyScreenshot(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  return executeSurveyDeckCommand(SURVEY_ECHO_COMMAND.SCREENSHOT, ctx);
}

async function sendEchoRemoteCommand(
  action: string,
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  const host = ctx.echoHost?.trim();
  if (!host) {
    return { ok: false, message: "Echo host unknown — check TEAM LINKS." };
  }

  const params = new URLSearchParams({
    echoHost: host,
    echoHttpPort: String(ctx.echoHttpPort),
  });

  try {
    const res = await fetch(`/api/survey/echo/remote-command?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      reason?: string;
      error?: string;
      message?: string;
      pngBase64?: string;
      listening?: boolean;
      clipboard?: { text?: string; hasImage?: boolean; formats?: string[] };
    };

    if (!res.ok || !payload.ok) {
      return {
        ok: false,
        message: payload.reason ?? payload.error ?? `Echo command failed (HTTP ${res.status}).`,
      };
    }

    if (action === SURVEY_ECHO_COMMAND.SCREENSHOT && payload.pngBase64) {
      storeLastCapture(payload.pngBase64);
    }
    if (action === SURVEY_ECHO_COMMAND.COPY_SELECTED) {
      const clipText = payload.clipboard?.text?.trim();
      if (payload.pngBase64 || clipText) {
        ingestMirageQueueItem({
          title: "Echo selection",
          prompt: clipText || SURVEY_SILENT_CAPTURE_PROMPT,
          imageDataUrl: payload.pngBase64
            ? `data:image/png;base64,${payload.pngBase64}`
            : undefined,
          source: "clipboard",
        });
      }
    }

    return {
      ok: true,
      message: payload.message ?? `${action} OK`,
      pngBase64: payload.pngBase64,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach Echo Satellite.",
    };
  }
}

/** Execute a Survey triforce deck card — Echo Satellite or Mirage hub. */
export async function executeSurveyDeckCommand(
  command: SurveyDeckCommandId,
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  logDeck(command);

  switch (command) {
    case SURVEY_ECHO_COMMAND.SCREENSHOT:
      return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.SCREENSHOT, ctx);
    case SURVEY_ECHO_COMMAND.START_LISTENING:
      return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.START_LISTENING, ctx);
    case SURVEY_ECHO_COMMAND.STOP_LISTENING:
      return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.STOP_LISTENING, ctx);
    case SURVEY_ECHO_COMMAND.SAVE_RECORDING:
      return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.SAVE_RECORDING, ctx);
    case SURVEY_ECHO_COMMAND.COPY_SELECTED:
      return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.COPY_SELECTED, ctx);
    case SURVEY_MIRAGE_COMMAND.NEXT_ITEM: {
      const result = applyMirageQueueControl({ action: "next" }, "powerfist");
      return { ok: result.ok, message: result.message };
    }
    case SURVEY_MIRAGE_COMMAND.PREVIOUS_ITEM: {
      const result = applyMirageQueueControl({ action: "prev" }, "powerfist");
      return { ok: result.ok, message: result.message };
    }
    case SURVEY_MIRAGE_COMMAND.ANSWER_ITEM: {
      const result = await answerCurrentMirageItemAsync();
      return { ok: result.ok, message: result.message };
    }
    case SURVEY_MIRAGE_COMMAND.DISPLAY_ITEM: {
      const result = displayCurrentMirageItem();
      return { ok: result.ok, message: result.message };
    }
    case SURVEY_MIRAGE_COMMAND.SPEECH_TO_TEXT:
      return runMirageSpeechToTextItem();
    default: {
      const _exhaustive: never = command;
      return { ok: false, message: `Unknown deck command: ${String(_exhaustive)}` };
    }
  }
}
