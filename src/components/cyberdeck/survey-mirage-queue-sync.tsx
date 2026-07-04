"use client";

import { useEffect } from "react";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";
import { installMirageQueueListeners } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { useSurveyTeamSocket } from "@/lib/cyberdeck/survey-team-socket.client";
import type { SurveyTeamSocketRole } from "@/lib/cyberdeck/survey-team-socket-types";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

type SurveyMirageQueueTeamHostProps = {
  role: SurveyTeamSocketRole;
};

/** Keeps team socket live for Mirage queue sync and wires capture ingest listeners. */
export function SurveyMirageQueueTeamHost({ role }: SurveyMirageQueueTeamHostProps) {
  const team = useSurveyTeamStatus();
  const mirageCreds = readSurveyMiragePairCredentials();
  const powerfistCreds = readSurveyPowerfistPairCredentials();
  const echoHost =
    team.echoHost?.trim() ||
    mirageCreds?.echoHost?.trim() ||
    powerfistCreds?.echoHost?.trim() ||
    null;
  const httpPort =
    mirageCreds?.httpPort ?? powerfistCreds?.httpPort ?? DEFAULT_ECHO_HTTP_PORT;

  useSurveyTeamSocket({
    role,
    echoHost,
    httpPort,
    enabled: Boolean(echoHost),
  });

  useEffect(() => installMirageQueueListeners(), []);

  return null;
}
