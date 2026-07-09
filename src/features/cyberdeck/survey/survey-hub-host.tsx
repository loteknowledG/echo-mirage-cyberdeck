"use client";

import { SurveyAutoPairHost } from "@/components/cyberdeck/survey-auto-pair-host";
import { useSurveyMuthurArchive } from "@/features/cyberdeck/hooks/use-survey-muthur-archive";

export type SurveyHubHostProps = {
  archiveMuthurHistoryLine: (text: string) => void;
  appendAssistantMessage: (text: string) => void;
  pinMuthurChatToBottom: () => void;
  focusMessageScroll: () => void;
};

/** Survey Hub auto-pair host + MUTHUR archive/focus bridge. */
export function SurveyHubHost({
  archiveMuthurHistoryLine,
  appendAssistantMessage,
  pinMuthurChatToBottom,
  focusMessageScroll,
}: SurveyHubHostProps) {
  useSurveyMuthurArchive({
    archiveMuthurHistoryLine,
    appendAssistantMessage,
    pinMuthurChatToBottom,
    focusMessageScroll,
  });

  return <SurveyAutoPairHost />;
}
