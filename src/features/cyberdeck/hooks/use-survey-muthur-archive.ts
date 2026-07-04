"use client";

import { useEffect } from "react";
import {
  SURVEY_FOCUS_CHAT_EVENT,
  SURVEY_MUTHUR_ARCHIVE_EVENT,
} from "@/lib/cyberdeck/survey-chat";

type SurveyMuthurArchiveOptions = {
  archiveMuthurHistoryLine: (text: string) => void;
  appendAssistantMessage: (text: string) => void;
  pinMuthurChatToBottom: () => void;
  focusMessageScroll: () => void;
};

/** Mirror Survey archive lines into MUTHUR chat and focus chat on Survey events. */
export function useSurveyMuthurArchive(options: SurveyMuthurArchiveOptions): void {
  const {
    archiveMuthurHistoryLine,
    appendAssistantMessage,
    pinMuthurChatToBottom,
    focusMessageScroll,
  } = options;

  useEffect(() => {
    const onSurveyMuthurArchive = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      if (!text) return;
      archiveMuthurHistoryLine(text);
      appendAssistantMessage(text);
      pinMuthurChatToBottom();
    };
    const onSurveyFocusChat = () => {
      pinMuthurChatToBottom();
      focusMessageScroll();
    };

    window.addEventListener(SURVEY_MUTHUR_ARCHIVE_EVENT, onSurveyMuthurArchive);
    window.addEventListener(SURVEY_FOCUS_CHAT_EVENT, onSurveyFocusChat);
    return () => {
      window.removeEventListener(SURVEY_MUTHUR_ARCHIVE_EVENT, onSurveyMuthurArchive);
      window.removeEventListener(SURVEY_FOCUS_CHAT_EVENT, onSurveyFocusChat);
    };
  }, [
    appendAssistantMessage,
    archiveMuthurHistoryLine,
    focusMessageScroll,
    pinMuthurChatToBottom,
  ]);
}
