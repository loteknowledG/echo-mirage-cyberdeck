"use client";

import { useCallback } from "react";
import { DeckMatrixEmbed } from "@/components/cyberdeck/deck-matrix-embed";
import { SURVEY_TRIFORCE_DECKS, type SurveyDeckCommandId } from "@/lib/cyberdeck/survey-deck-data";
import {
  executeSurveyDeckCommand,
  resolveSurveyEchoDeckContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

type SurveyTriforceDeckEmbedProps = {
  className?: string;
};

/** Echo + Mirage command decks for Survey PowerFist when triple-linked. */
export function SurveyTriforceDeckEmbed({ className = "" }: SurveyTriforceDeckEmbedProps) {
  const team = useSurveyTeamStatus();

  const handleDeckCommand = useCallback(
    async (command: string) => {
      return executeSurveyDeckCommand(
        command as SurveyDeckCommandId,
        resolveSurveyEchoDeckContext(team.echoHost),
      );
    },
    [team.echoHost],
  );

  return (
    <DeckMatrixEmbed
      className={className}
      embedSurface="survey"
      decks={SURVEY_TRIFORCE_DECKS}
      onDeckCommand={handleDeckCommand}
    />
  );
}
