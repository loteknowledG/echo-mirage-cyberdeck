import type { SurveyMissionSolveDetail } from "@/lib/cyberdeck/powerfist-mission.types";
import type { SurveyMirageQueueItem } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { resolveMirageQueueItemImage } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { appendSurveyChatMessage } from "@/lib/cyberdeck/survey-chat";
import { SURVEY_ECHO_DISPLAY, SURVEY_MIRAGE_DISPLAY } from "@/lib/cyberdeck/survey-mode";

export type SurveyOperatorImageAsset = {
  kind: "image";
  name: string;
  mimeType: string;
  size: number;
  surface: "image";
  imageSrc: string;
};

export function buildSurveyMissionPreviewAsset(
  detail: SurveyMissionSolveDetail,
): SurveyOperatorImageAsset {
  return {
    kind: "image",
    name: `echo-${detail.missionId.slice(0, 8)}.png`,
    mimeType: "image/png",
    size: 0,
    surface: "image",
    imageSrc: detail.imageDataUrl,
  };
}

export function formatSurveyMissionSystemLine(detail: SurveyMissionSolveDetail): string {
  return `SURVEY // ${SURVEY_ECHO_DISPLAY} capture → ${SURVEY_MIRAGE_DISPLAY} // mission ${detail.missionId.slice(0, 8)}…`;
}

export function buildSurveyMissionMuthurPrompt(detail: SurveyMissionSolveDetail): string {
  return `${detail.prompt}\n\n[System: ${SURVEY_ECHO_DISPLAY} screenshot is in the operator image preview. Use observe_operator_pane (surface operator) to inspect it before answering.]`;
}

export function appendSurveyMissionChatLines(
  detail: SurveyMissionSolveDetail,
  missionLine: string,
): void {
  appendSurveyChatMessage({ role: "system", text: missionLine });
  appendSurveyChatMessage({ role: "user", text: detail.prompt });
}

export function buildMirageItemPreviewAsset(
  item: SurveyMirageQueueItem,
): SurveyOperatorImageAsset | null {
  const imageSrc = resolveMirageQueueItemImage(item);
  if (!imageSrc) return null;
  return {
    kind: "image",
    name: `mirage-${item.id.slice(0, 8)}.png`,
    mimeType: "image/png",
    size: 0,
    surface: "image",
    imageSrc,
  };
}

export function formatMirageItemDisplayLine(item: SurveyMirageQueueItem): string {
  return `SURVEY // DISPLAY // ${item.title}`;
}

export function appendMirageItemChatLines(item: SurveyMirageQueueItem, displayLine: string): void {
  appendSurveyChatMessage({ role: "system", text: displayLine });
  if (item.transcript?.trim() || item.prompt?.trim()) {
    appendSurveyChatMessage({
      role: "user",
      text: item.transcript?.trim() || item.prompt.trim(),
    });
  }
}
