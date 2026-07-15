"use client";

import { storeLastSurveySelection } from "@/lib/cyberdeck/survey-deck-command.client";
import {
  ingestMirageQueueItem,
  solveMirageSelectedTextAsync,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { notifySurveyMuthurArchive, notifySurveyFocusChat } from "@/lib/cyberdeck/survey-chat";
import {
  SURVEY_EXTENSION_MAX_PAGE_TEXT_CHARS,
  SURVEY_EXTENSION_PAGE_CONTEXT_EVENT,
  SURVEY_EXTENSION_PAGE_CONTEXT_MESSAGE_TYPE,
  type SurveyExtensionPageSnapshot,
} from "@/lib/cyberdeck/survey-extension-page-context";
import { useEffect, useState } from "react";

export type SurveyExtensionPageContextStatus = {
  lastSnapshot: SurveyExtensionPageSnapshot | null;
  deliveredAt: string | null;
  deliveryCount: number;
};

let status: SurveyExtensionPageContextStatus = {
  lastSnapshot: null,
  deliveredAt: null,
  deliveryCount: 0,
};

export const SURVEY_EXTENSION_PAGE_CONTEXT_CHANGED_EVENT =
  "echo-mirage:survey-extension-page-context-changed";

function emitChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_EXTENSION_PAGE_CONTEXT_CHANGED_EVENT));
}

function clampPageText(text: string): string {
  return text.trim().slice(0, SURVEY_EXTENSION_MAX_PAGE_TEXT_CHARS);
}

export function formatSurveyExtensionPageContextForMuthur(
  snapshot: SurveyExtensionPageSnapshot,
): string {
  const title = snapshot.title.trim() || "(untitled)";
  const preview = snapshot.pageText.trim().slice(0, 320);
  const suffix = snapshot.pageText.length > preview.length ? "…" : "";
  return [
    "ECHO-EXTENSION // RECEIVED · browser page capture",
    `URL · ${snapshot.url}`,
    `TITLE · ${title}`,
    `TEXT · ${preview}${suffix}`,
  ].join("\n");
}

function stageExtensionCaptureForSolve(snapshot: SurveyExtensionPageSnapshot): void {
  const text = snapshot.pageText.trim();
  if (!text) return;
  storeLastSurveySelection(text);
  ingestMirageQueueItem({
    title: snapshot.title.trim() || "Extension page",
    prompt: text,
    source: "clipboard",
    select: true,
  });
}

export function ingestSurveyExtensionPageContext(raw: unknown): SurveyExtensionPageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<SurveyExtensionPageSnapshot>;
  const url = typeof input.url === "string" ? input.url.trim() : "";
  let pageText = typeof input.pageText === "string" ? clampPageText(input.pageText) : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!pageText) {
    pageText = clampPageText([title, url].filter(Boolean).join(" · "));
  }
  if (!url || !pageText) return null;

  const snapshot: SurveyExtensionPageSnapshot = {
    url,
    title,
    pageText,
    capturedAt:
      typeof input.capturedAt === "string" && input.capturedAt.trim()
        ? input.capturedAt
        : new Date().toISOString(),
    source: typeof input.source === "string" ? input.source : "echo-extension",
  };

  status = {
    lastSnapshot: snapshot,
    deliveredAt: new Date().toISOString(),
    deliveryCount: status.deliveryCount + 1,
  };
  stageExtensionCaptureForSolve(snapshot);
  notifySurveyMuthurArchive(formatSurveyExtensionPageContextForMuthur(snapshot));
  notifySurveyFocusChat();
  emitChanged();
  return snapshot;
}

/** Run SOLVE on the last echo-extension page text (HackerRank / tab capture). */
export async function solveLastSurveyExtensionPage(): Promise<{ ok: boolean; message: string }> {
  const snapshot = status.lastSnapshot;
  if (!snapshot?.pageText.trim()) {
    return {
      ok: false,
      message: "No extension page text yet — Capture active tab (focus HackerRank first).",
    };
  }
  return solveMirageSelectedTextAsync(snapshot.pageText);
}

export function readSurveyExtensionPageContextStatus(): SurveyExtensionPageContextStatus {
  return status;
}

export function useSurveyExtensionPageContextStatus(): SurveyExtensionPageContextStatus {
  const [live, setLive] = useState<SurveyExtensionPageContextStatus>(status);

  useEffect(() => {
    const refresh = () => setLive({ ...status });
    refresh();
    window.addEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_CHANGED_EVENT, refresh);
  }, []);

  return live;
}

export function useSurveyExtensionPageContextListener(): void {
  useEffect(() => {
    const onCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      ingestSurveyExtensionPageContext(detail);
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const message = data as {
        source?: string;
        type?: string;
        payload?: unknown;
      };
      if (message.source !== "echo-extension" && message.source !== "echo-mirage-survey-extension") {
        return;
      }
      if (message.type !== SURVEY_EXTENSION_PAGE_CONTEXT_MESSAGE_TYPE) return;
      ingestSurveyExtensionPageContext(message.payload);
    };

    window.addEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT, onCustomEvent);
    window.addEventListener("message", onWindowMessage);
    return () => {
      window.removeEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT, onCustomEvent);
      window.removeEventListener("message", onWindowMessage);
    };
  }, []);
}
