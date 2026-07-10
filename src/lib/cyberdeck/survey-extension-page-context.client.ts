"use client";

import { useEffect, useState } from "react";
import {
  SURVEY_EXTENSION_MAX_PAGE_TEXT_CHARS,
  SURVEY_EXTENSION_PAGE_CONTEXT_EVENT,
  type SurveyExtensionPageSnapshot,
} from "@/lib/cyberdeck/survey-extension-page-context";
import { notifySurveyMuthurArchive, notifySurveyFocusChat } from "@/lib/cyberdeck/survey-chat";

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
    "SURVEY SATELLITE // RECEIVED · browser page capture",
    `URL · ${snapshot.url}`,
    `TITLE · ${title}`,
    `TEXT · ${preview}${suffix}`,
  ].join("\n");
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
    source: typeof input.source === "string" ? input.source : "echo-mirage-survey-extension",
  };

  status = {
    lastSnapshot: snapshot,
    deliveredAt: new Date().toISOString(),
    deliveryCount: status.deliveryCount + 1,
  };
  notifySurveyMuthurArchive(formatSurveyExtensionPageContextForMuthur(snapshot));
  notifySurveyFocusChat();
  emitChanged();
  return snapshot;
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
    const onDelivered = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      ingestSurveyExtensionPageContext(detail);
    };
    window.addEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT, onDelivered);
    return () => window.removeEventListener(SURVEY_EXTENSION_PAGE_CONTEXT_EVENT, onDelivered);
  }, []);
}
