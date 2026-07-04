"use client";

import { useCallback } from "react";
import { PreviewMatrix } from "@/app/preview/preview-matrix";
import "@/app/preview/preview-matrix.css";
import { SURVEY_TRIFORCE_DECKS, type SurveyDeckCommandId } from "@/lib/cyberdeck/survey-deck-data";
import { executeSurveyDeckCommand } from "@/lib/cyberdeck/survey-deck-command.client";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

type SurveyTriforceDeckEmbedProps = {
  className?: string;
};

/** Echo + Mirage command decks for Survey PowerFist when triple-linked. */
export function SurveyTriforceDeckEmbed({ className = "" }: SurveyTriforceDeckEmbedProps) {
  const team = useSurveyTeamStatus();
  const echoHttpPort =
    readSurveyMiragePairCredentials()?.httpPort ??
    readSurveyPowerfistPairCredentials()?.httpPort ??
    DEFAULT_ECHO_HTTP_PORT;

  const handleDeckCommand = useCallback(
    async (command: SurveyDeckCommandId) => {
      return executeSurveyDeckCommand(command, {
        echoHost: team.echoHost,
        echoHttpPort,
      });
    },
    [team.echoHost, echoHttpPort],
  );

  return (
    <div className={`powerfist-preview-layout min-h-0 w-full overflow-hidden ${className}`.trim()}>
      <PreviewMatrix
        embedSurface="survey"
        decks={SURVEY_TRIFORCE_DECKS}
        onDeckCommand={handleDeckCommand}
      />
    </div>
  );
}
