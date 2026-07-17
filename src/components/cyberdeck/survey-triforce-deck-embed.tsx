"use client";

import { useCallback } from "react";
import { DeckMatrixEmbed } from "@/components/cyberdeck/deck-matrix-embed";
import {
  SURVEY_POWERFIST_DECKS,
  type SurveyPowerfistDeckCommandId,
} from "@/lib/cyberdeck/survey-deck-data";
import {
  executeSurveyPowerfistDeckCommand,
  resolveSurveyEchoDeckContext,
} from "@/lib/cyberdeck/survey-powerfist-deck-command.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

type SurveyTriforceDeckEmbedProps = {
  className?: string;
};

/** Survey PowerFist decks — Screenshot + Extension flows (no wrap; position = navigation). */
export function SurveyTriforceDeckEmbed({ className = "" }: SurveyTriforceDeckEmbedProps) {
  const team = useSurveyTeamStatus();

  const handleDeckCommand = useCallback(
    async (command: string) => {
      return executeSurveyPowerfistDeckCommand(
        command as SurveyPowerfistDeckCommandId,
        resolveSurveyEchoDeckContext(team.echoHost),
      );
    },
    [team.echoHost],
  );

  return (
    <DeckMatrixEmbed
      className={className}
      embedSurface="survey"
      decks={SURVEY_POWERFIST_DECKS}
      onDeckCommand={handleDeckCommand}
    />
  );
}
