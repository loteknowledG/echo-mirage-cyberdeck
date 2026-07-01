"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_POWERFIST_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";

export const SURVEY_MUTHUR_ARCHIVE_EVENT = "echo-mirage:survey-muthur-archive";
export const SURVEY_CHAT_CHANGED_EVENT = "echo-mirage:survey-chat-changed";
export const SURVEY_FOCUS_CHAT_EVENT = "echo-mirage:survey-focus-chat";

const LEGACY_SURVEY_CHAT_CHANGED_EVENTS = ["echo-mirage:espionage-chat-changed"] as const;
const LEGACY_SURVEY_FOCUS_CHAT_EVENTS = ["echo-mirage:espionage-focus-chat"] as const;

export type SurveyChatRole = "system" | "assistant" | "user";

export type SurveyChatMessage = {
  id: string;
  role: SurveyChatRole;
  text: string;
  at: string;
};

const MAX_MESSAGES = 80;
let messages: SurveyChatMessage[] = [];

function emitChatChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_CHAT_CHANGED_EVENT));
}

export function readSurveyChatMessages(): SurveyChatMessage[] {
  return messages;
}

export function appendSurveyChatMessage(input: {
  role: SurveyChatRole;
  text: string;
}): SurveyChatMessage {
  const entry: SurveyChatMessage = {
    id: crypto.randomUUID(),
    role: input.role,
    text: input.text.trim(),
    at: new Date().toISOString(),
  };
  if (!entry.text) return entry;
  messages = [...messages, entry].slice(-MAX_MESSAGES);
  emitChatChanged();
  return entry;
}

export function notifySurveyMuthurArchive(text: string): void {
  const line = text.trim();
  if (!line) return;
  appendSurveyChatMessage({ role: "system", text: line });
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_MUTHUR_ARCHIVE_EVENT, { detail: { text: line } }));
}

/** @deprecated Use notifySurveyMuthurArchive */
export const notifySpyMuthurArchive = notifySurveyMuthurArchive;

export function notifySurveyFocusChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_FOCUS_CHAT_EVENT));
}

export function formatSurveyEchoMirageLinkedLine(echoHost: string): string {
  return `SURVEY // ${SURVEY_ECHO_DISPLAY} ↔ ${SURVEY_MIRAGE_DISPLAY} // LINKED @ ${echoHost}`;
}

export function formatSurveyEchoPowerfistLinkedLine(echoHost: string): string {
  return `SURVEY // ${SURVEY_ECHO_DISPLAY} ↔ ${SURVEY_POWERFIST_DISPLAY} // LINKED @ ${echoHost}`;
}

export function formatSurveyMiragePowerfistLinkedLine(deviceId: string): string {
  return `SURVEY // ${SURVEY_MIRAGE_DISPLAY} ↔ ${SURVEY_POWERFIST_DISPLAY} // LINKED · device ${deviceId.slice(0, 8)}…`;
}

export function formatSurveySolutionsReadyLine(): string {
  return `SURVEY // ${SURVEY_MIRAGE_DISPLAY} hub ready — PowerFist capture solutions will appear here and in MUTHUR chat.`;
}

export function useSurveyChatMessages(): SurveyChatMessage[] {
  const [entries, setEntries] = useState<SurveyChatMessage[]>(() => readSurveyChatMessages());

  const refresh = useCallback(() => {
    setEntries([...readSurveyChatMessages()]);
  }, []);

  useEffect(() => {
    refresh();
    const events = [SURVEY_CHAT_CHANGED_EVENT, ...LEGACY_SURVEY_CHAT_CHANGED_EVENTS];
    for (const eventName of events) {
      window.addEventListener(eventName, refresh);
    }
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, refresh);
      }
    };
  }, [refresh]);

  return entries;
}
