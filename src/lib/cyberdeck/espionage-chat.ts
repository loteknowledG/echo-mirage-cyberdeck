"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_POWERFIST_DISPLAY,
} from "@/lib/cyberdeck/espionage-mode";

export const SPY_MUTHUR_ARCHIVE_EVENT = "echo-mirage:spy-muthur-archive";
export const ESPIONAGE_CHAT_CHANGED_EVENT = "echo-mirage:espionage-chat-changed";
export const ESPIONAGE_FOCUS_CHAT_EVENT = "echo-mirage:espionage-focus-chat";

export type EspionageChatRole = "system" | "assistant" | "user";

export type EspionageChatMessage = {
  id: string;
  role: EspionageChatRole;
  text: string;
  at: string;
};

const MAX_MESSAGES = 80;
let messages: EspionageChatMessage[] = [];

function emitChatChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ESPIONAGE_CHAT_CHANGED_EVENT));
}

export function readEspionageChatMessages(): EspionageChatMessage[] {
  return messages;
}

export function appendEspionageChatMessage(input: {
  role: EspionageChatRole;
  text: string;
}): EspionageChatMessage {
  const entry: EspionageChatMessage = {
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

export function notifySpyMuthurArchive(text: string): void {
  const line = text.trim();
  if (!line) return;
  appendEspionageChatMessage({ role: "system", text: line });
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPY_MUTHUR_ARCHIVE_EVENT, { detail: { text: line } }));
}

export function notifyEspionageFocusChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ESPIONAGE_FOCUS_CHAT_EVENT));
}

export function formatEspionageEchoMirageLinkedLine(echoHost: string): string {
  return `ESPIONAGE // ${ESPIONAGE_ECHO_DISPLAY} ↔ ${ESPIONAGE_MIRAGE_DISPLAY} // LINKED @ ${echoHost}`;
}

export function formatEspionageEchoPowerfistLinkedLine(echoHost: string): string {
  return `ESPIONAGE // ${ESPIONAGE_ECHO_DISPLAY} ↔ ${ESPIONAGE_POWERFIST_DISPLAY} // LINKED @ ${echoHost}`;
}

export function formatEspionageMiragePowerfistLinkedLine(deviceId: string): string {
  return `ESPIONAGE // ${ESPIONAGE_MIRAGE_DISPLAY} ↔ ${ESPIONAGE_POWERFIST_DISPLAY} // LINKED · device ${deviceId.slice(0, 8)}…`;
}

export function formatEspionageSolutionsReadyLine(): string {
  return `ESPIONAGE // ${ESPIONAGE_MIRAGE_DISPLAY} hub ready — PowerFist capture solutions will appear here and in MUTHUR chat.`;
}

export function useEspionageChatMessages(): EspionageChatMessage[] {
  const [entries, setEntries] = useState<EspionageChatMessage[]>(() => readEspionageChatMessages());

  const refresh = useCallback(() => {
    setEntries([...readEspionageChatMessages()]);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(ESPIONAGE_CHAT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ESPIONAGE_CHAT_CHANGED_EVENT, refresh);
  }, [refresh]);

  return entries;
}
