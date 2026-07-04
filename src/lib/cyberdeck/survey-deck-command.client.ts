"use client";

import {
  SURVEY_ECHO_COMMAND,
  SURVEY_MIRAGE_COMMAND,
  type SurveyDeckCommandId,
} from "@/lib/cyberdeck/survey-deck-data";
import {
  answerCurrentMirageItem,
  applyMirageQueueControl,
  displayCurrentMirageItem,
  ingestMirageQueueItem,
  runMirageSpeechToTextItem,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { SURVEY_SILENT_CAPTURE_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";

export const SURVEY_LAST_CAPTURE_STORAGE_KEY = "echo-mirage-survey-last-capture-v1";
export const SURVEY_LAST_CAPTURE_EVENT = "echo-mirage-survey-last-capture";

export type SurveyDeckCommandResult = {
  ok: boolean;
  message: string;
  pngBase64?: string;
};

type SurveyDeckCommandContext = {
  echoHost: string | null;
  echoHttpPort: number;
};

function logDeck(line: string): void {
  notifySurveyMuthurArchive(`SURVEY DECK // ${line}`);
}

function storeLastCapture(pngBase64: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SURVEY_LAST_CAPTURE_STORAGE_KEY,
      JSON.stringify({ pngBase64, at: new Date().toISOString() }),
    );
    window.dispatchEvent(
      new CustomEvent(SURVEY_LAST_CAPTURE_EVENT, {
        detail: { pngBase64 },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function readLastSurveyCapture(): { pngBase64: string; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SURVEY_LAST_CAPTURE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pngBase64?: string; at?: string };
    if (!parsed.pngBase64?.trim()) return null;
    return { pngBase64: parsed.pngBase64, at: parsed.at ?? "" };
  } catch {
    return null;
  }
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
      const result = answerCurrentMirageItem();
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
