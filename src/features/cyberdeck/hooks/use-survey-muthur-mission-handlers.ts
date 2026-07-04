"use client";

import { useCallback, useEffect } from "react";
import {
  SURVEY_MISSION_SOLVE_EVENT,
  type SurveyMissionSolveDetail,
} from "@/lib/cyberdeck/powerfist-mission.types";
import {
  SURVEY_MIRAGE_ITEM_DISPLAY_EVENT,
  type SurveyMirageQueueItem,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { notifySurveyFocusChat } from "@/lib/cyberdeck/survey-chat";
import {
  appendMirageItemChatLines,
  appendSurveyMissionChatLines,
  buildMirageItemPreviewAsset,
  buildSurveyMissionMuthurPrompt,
  buildSurveyMissionPreviewAsset,
  formatMirageItemDisplayLine,
  formatSurveyMissionSystemLine,
  type SurveyOperatorImageAsset,
} from "@/lib/cyberdeck/survey-muthur-mission.client";

type SurveyMuthurMissionHandlersOptions = {
  revokeOperatorBlobUrl: (url: string | null) => void;
  operatorPreviewBlobUrlRef: React.MutableRefObject<string | null>;
  showOperatorImage: (asset: SurveyOperatorImageAsset) => void;
  prependSystemMessage: (text: string) => void;
  sendMuthurPrompt: (
    prompt: string,
    options?: { preserveSelectedSurface?: boolean; surveyMission?: boolean },
  ) => void;
};

export function useSurveyMuthurMissionHandlers(options: SurveyMuthurMissionHandlersOptions) {
  const {
    revokeOperatorBlobUrl,
    operatorPreviewBlobUrlRef,
    showOperatorImage,
    prependSystemMessage,
    sendMuthurPrompt,
  } = options;

  const handleSurveyMissionSolve = useCallback(
    (detail: SurveyMissionSolveDetail) => {
      revokeOperatorBlobUrl(operatorPreviewBlobUrlRef.current);
      operatorPreviewBlobUrlRef.current = null;
      showOperatorImage(buildSurveyMissionPreviewAsset(detail));
      const missionLine = formatSurveyMissionSystemLine(detail);
      prependSystemMessage(missionLine);
      appendSurveyMissionChatLines(detail, missionLine);
      notifySurveyFocusChat();
      sendMuthurPrompt(buildSurveyMissionMuthurPrompt(detail), {
        preserveSelectedSurface: true,
        surveyMission: true,
      });
    },
    [
      operatorPreviewBlobUrlRef,
      prependSystemMessage,
      revokeOperatorBlobUrl,
      sendMuthurPrompt,
      showOperatorImage,
    ],
  );

  const handleMirageItemDisplay = useCallback(
    (item: SurveyMirageQueueItem) => {
      const asset = buildMirageItemPreviewAsset(item);
      if (!asset) return;
      revokeOperatorBlobUrl(operatorPreviewBlobUrlRef.current);
      operatorPreviewBlobUrlRef.current = null;
      showOperatorImage(asset);
      const displayLine = formatMirageItemDisplayLine(item);
      prependSystemMessage(displayLine);
      appendMirageItemChatLines(item, displayLine);
    },
    [operatorPreviewBlobUrlRef, prependSystemMessage, revokeOperatorBlobUrl, showOperatorImage],
  );

  useEffect(() => {
    const onMissionSolve = (event: Event) => {
      handleSurveyMissionSolve((event as CustomEvent<SurveyMissionSolveDetail>).detail);
    };
    const onMirageItemDisplay = (event: Event) => {
      handleMirageItemDisplay((event as CustomEvent<SurveyMirageQueueItem>).detail);
    };

    window.addEventListener(SURVEY_MISSION_SOLVE_EVENT, onMissionSolve);
    window.addEventListener(SURVEY_MIRAGE_ITEM_DISPLAY_EVENT, onMirageItemDisplay);
    return () => {
      window.removeEventListener(SURVEY_MISSION_SOLVE_EVENT, onMissionSolve);
      window.removeEventListener(SURVEY_MIRAGE_ITEM_DISPLAY_EVENT, onMirageItemDisplay);
    };
  }, [handleMirageItemDisplay, handleSurveyMissionSolve]);

  return { handleSurveyMissionSolve, handleMirageItemDisplay };
}
