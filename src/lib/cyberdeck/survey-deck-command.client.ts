"use client";

import {
  SURVEY_ECHO_COMMAND,
  SURVEY_ECHO_READ_CLIPBOARD_ACTION,
  SURVEY_MIRAGE_COMMAND,
  type SurveyDeckCommandId,
} from "@/lib/cyberdeck/survey-deck-data";
import {
  answerCurrentMirageItemAsync,
  applyMirageQueueControl,
  displayCurrentMirageItem,
  ingestMirageQueueItem,
  runMirageSpeechToTextItem,
  solveMirageCaptureAsync,
  solveMirageSelectedTextAsync,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import {
  isSurveyContinuousScreenshotRunning,
  startSurveyContinuousScreenshot,
  stopSurveyContinuousScreenshot,
} from "@/lib/cyberdeck/survey-continuous-screenshot.client";
import { SURVEY_SILENT_CAPTURE_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";
import { pushSurveyCaptureStackPage } from "@/lib/cyberdeck/survey-capture-stack.client";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import {
  isSurveyHttpsPairBlocked,
  SURVEY_PWA_PAIR_BLOCKED_MESSAGE,
} from "@/lib/cyberdeck/survey-pairing-shared.client";
import { readSurveyPairPinDraft } from "@/lib/cyberdeck/survey-pair-pin-draft";
import {
  DEFAULT_ECHO_HTTP_PORT,
  DEFAULT_ECHO_TAILSCALE_HOST,
  isTailscaleCgNatHost,
  preferMeshEchoHost,
} from "@/lib/cyberdeck/survey-pair-pin";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";

export const SURVEY_LAST_CAPTURE_STORAGE_KEY = "echo-mirage-survey-last-capture-v1";
export const SURVEY_LAST_CAPTURE_EVENT = "echo-mirage-survey-last-capture";
export const SURVEY_LAST_SELECTION_STORAGE_KEY = "echo-mirage-survey-last-selection-v1";
export const SURVEY_LAST_SELECTION_EVENT = "echo-mirage-survey-last-selection";

export type SurveyDeckCommandResult = {
  ok: boolean;
  message: string;
  pngBase64?: string;
  clipboardText?: string;
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
  const mirageDraft = readSurveyPairPinDraft("mirage");
  const powerfistDraft = readSurveyPairPinDraft("powerfist");
  const draftHost =
    mirageDraft?.echoHost?.trim() || powerfistDraft?.echoHost?.trim() || null;
  const draftPortRaw =
    mirageDraft?.echoHttpPort?.trim() || powerfistDraft?.echoHttpPort?.trim() || "";
  const draftPort = Number(draftPortRaw);

  // Prefer saved/draft mesh host over team LAN IP (Satellite often reports 10.x / 192.168).
  const candidates = [
    mirageCreds?.echoHost?.trim(),
    draftHost,
    powerfistCreds?.echoHost?.trim(),
    teamEchoHost?.trim(),
  ].filter((value): value is string => Boolean(value));

  const meshCandidate = candidates.find((host) => isTailscaleCgNatHost(host));
  let echoHost =
    meshCandidate ??
    preferMeshEchoHost(candidates[0] ?? null) ??
    null;
  let echoHttpPort =
    mirageCreds?.httpPort ??
    powerfistCreds?.httpPort ??
    (Number.isFinite(draftPort) && draftPort > 0 ? draftPort : DEFAULT_ECHO_HTTP_PORT);

  // Local HTTP / desktop shell can reach Tailscale Echo; hosted HTTPS PWA cannot.
  if (!echoHost && typeof window !== "undefined" && !isSurveyHttpsPairBlocked()) {
    const { hostname } = window.location;
    const localHttp =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      isEchoMirageDesktopShell();
    if (localHttp) {
      // Windows Mirage ↔ Mac Echo over mesh (form default). Same-machine EMP can override via draft.
      echoHost = DEFAULT_ECHO_TAILSCALE_HOST;
      echoHttpPort = DEFAULT_ECHO_HTTP_PORT;
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
  // Multi-page questions: each screenshot appends to the session stack.
  pushSurveyCaptureStackPage(pngBase64);
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

export function storeLastSurveySelection(text: string): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const payload = { text: trimmed, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(SURVEY_LAST_SELECTION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(SURVEY_LAST_SELECTION_EVENT, {
      detail: { text: trimmed },
    }),
  );
}

export function readLastSurveySelection(): { text: string; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SURVEY_LAST_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { text?: string; at?: string };
    if (!parsed.text?.trim()) return null;
    return { text: parsed.text.trim(), at: parsed.at ?? "" };
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

/** Copy Echo selection and run Codex on the text — usable from Mirage or PowerFist. */
export async function solveSurveySelectedText(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  return executeSurveyDeckCommand(SURVEY_ECHO_COMMAND.SOLVE_SELECTED_TEXT, ctx);
}

/** Read Echo clipboard (no synthetic copy) and run Codex — use after Ctrl+C. */
export async function solveSurveyClipboard(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  return executeSurveyDeckCommand(SURVEY_ECHO_COMMAND.SOLVE_CLIPBOARD, ctx);
}

async function sendEchoRemoteCommand(
  action: string,
  ctx: SurveyDeckCommandContext,
  options?: { ingestClipboard?: boolean },
): Promise<SurveyDeckCommandResult> {
  if (isSurveyHttpsPairBlocked()) {
    return { ok: false, message: SURVEY_PWA_PAIR_BLOCKED_MESSAGE };
  }

  const host = ctx.echoHost?.trim();
  if (!host) {
    return {
      ok: false,
      message: `Echo host unknown — enter the ${DEFAULT_ECHO_TAILSCALE_HOST} Tailscale IP above, then retry.`,
    };
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
    const clipText = payload.clipboard?.text?.trim();
    const shouldIngest =
      options?.ingestClipboard !== false && action === SURVEY_ECHO_COMMAND.COPY_SELECTED;
    if (shouldIngest && (payload.pngBase64 || clipText)) {
      if (clipText) {
        storeLastSurveySelection(clipText);
      }
      ingestMirageQueueItem({
        title: "Echo selection",
        prompt: clipText || SURVEY_SILENT_CAPTURE_PROMPT,
        imageDataUrl: payload.pngBase64
          ? `data:image/png;base64,${payload.pngBase64}`
          : undefined,
        source: "clipboard",
      });
    }

    return {
      ok: true,
      message: payload.message ?? `${action} OK`,
      pngBase64: payload.pngBase64,
      clipboardText: clipText,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach Echo Satellite.",
    };
  }
}

/** Copy Echo frontmost selection without staging a queue item. */
async function fetchEchoSelectedContent(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  return sendEchoRemoteCommand(SURVEY_ECHO_COMMAND.COPY_SELECTED, ctx, {
    ingestClipboard: false,
  });
}

/** Read Echo clipboard only — no synthetic Ctrl+C. */
async function fetchEchoClipboardContent(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  return sendEchoRemoteCommand(SURVEY_ECHO_READ_CLIPBOARD_ACTION, ctx, {
    ingestClipboard: false,
  });
}

async function solveEchoClipboardPayload(
  copy: SurveyDeckCommandResult,
  emptyMessage: string,
): Promise<SurveyDeckCommandResult> {
  if (!copy.ok) {
    return copy;
  }

  const text = copy.clipboardText?.trim();
  if (text) {
    storeLastSurveySelection(text);
    return solveMirageSelectedTextAsync(text);
  }

  if (copy.pngBase64) {
    ingestMirageQueueItem({
      title: "Echo clipboard",
      prompt: SURVEY_SILENT_CAPTURE_PROMPT,
      imageDataUrl: `data:image/png;base64,${copy.pngBase64}`,
      source: "clipboard",
    });
    const solved = await solveMirageCaptureAsync();
    return {
      ok: solved.ok,
      message: solved.ok
        ? `Clipboard had no text — solved image via Codex. ${solved.message}`
        : solved.message,
      pngBase64: copy.pngBase64,
    };
  }

  return { ok: false, message: emptyMessage };
}

async function solveEchoSelectedText(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  const copy = await fetchEchoSelectedContent(ctx);
  return solveEchoClipboardPayload(
    copy,
    "Nothing selected on Echo — highlight the problem text on the interview machine, then retry.",
  );
}

async function solveEchoClipboard(
  ctx: SurveyDeckCommandContext,
): Promise<SurveyDeckCommandResult> {
  const copy = await fetchEchoClipboardContent(ctx);
  return solveEchoClipboardPayload(
    copy,
    "Nothing on Echo clipboard — Ctrl+C the problem text on the interview machine, then retry.",
  );
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
    case SURVEY_ECHO_COMMAND.SOLVE_SELECTED_TEXT:
      return solveEchoSelectedText(ctx);
    case SURVEY_ECHO_COMMAND.SOLVE_CLIPBOARD:
      return solveEchoClipboard(ctx);
    case SURVEY_ECHO_COMMAND.CONTINUOUS_SCREENSHOTS: {
      if (isSurveyContinuousScreenshotRunning()) {
        return stopSurveyContinuousScreenshot();
      }
      return startSurveyContinuousScreenshot(ctx);
    }
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
