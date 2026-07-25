"use client";

import { fetchPowerfistQrSession, readPowerfistRemoteCredentials } from "@/lib/cyberdeck/survey-hub-socket";
import {
  linkFromBool,
  type SurveyTeamStatus,
} from "@/lib/cyberdeck/survey-team-status";
import {
  fetchEchoSurveyStatus,
  fetchEchoRemoteSurveyStatusClient,
  normalizePairedMirages,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type EchoSurveyStatus,
} from "@/lib/cyberdeck/survey-pairing-client";

function formatMirageLinkDetail(mirages: { nodeId: string }[]): string {
  if (mirages.length === 0) return "Waiting for Mirage code.";
  if (mirages.length === 1) return `node ${mirages[0].nodeId.slice(0, 8)}…`;
  return `${mirages.length} linked · ${mirages.map((mirage) => mirage.nodeId.slice(0, 8)).join(", ")}…`;
}

function formatPowerfistLinkDetail(deviceId: string, echoHost?: string | null): string {
  const prefix = echoHost ? `${echoHost} · ` : "";
  return `${prefix}device ${deviceId.slice(0, 8)}…`;
}

/** Single probe used by team status UI and hub connect guards. */
export async function probeSurveyTeamStatus(): Promise<SurveyTeamStatus> {
  const result = await probeSurveyTeamStatusDetailed();
  return result.team;
}

export type SurveyTeamStatusProbeResult = {
  team: SurveyTeamStatus;
  echo: EchoSurveyStatus | null;
  echoFetchFailedReason: string | null;
};

/** One coordinated network pass for team + echo snapshot consumers. */
export async function probeSurveyTeamStatusDetailed(): Promise<SurveyTeamStatusProbeResult> {
  const mirageCreds = readSurveyMiragePairCredentials();
  const powerfistCreds = readSurveyPowerfistPairCredentials();
  const echoHost = mirageCreds?.echoHost ?? powerfistCreds?.echoHost ?? null;
  const echoHttpPort = mirageCreds?.httpPort ?? powerfistCreds?.httpPort ?? 3050;

  let echoMirage = linkFromBool(false, "Waiting for Survey Hub to link Mirage.");
  let echoPowerfist = linkFromBool(false, "Waiting for Survey Hub to link PowerFist.");
  let miragePowerfist = linkFromBool(
    false,
    "Enter Mirage hub code on PowerFist tab, or scan hub QR.",
  );

  const echoLocal = await fetchEchoSurveyStatus();
  let authoritative: EchoSurveyStatus | null = echoLocal.ok ? echoLocal : null;
  let echoFetchFailedReason: string | null = echoLocal.ok ? null : echoLocal.reason;

  if (!authoritative && echoHost) {
    const remote = await fetchEchoRemoteSurveyStatusClient(echoHost, echoHttpPort);
    if (remote.ok) {
      authoritative = remote;
      echoFetchFailedReason = null;
    } else if (!echoFetchFailedReason) {
      echoFetchFailedReason = remote.reason;
    }
  }

  if (authoritative) {
    const mirages = normalizePairedMirages(authoritative);
    echoMirage = mirages.length
      ? linkFromBool(true, formatMirageLinkDetail(mirages))
      : linkFromBool(false, "Waiting for Mirage code.");
    echoPowerfist = authoritative.pairedPowerfist
      ? linkFromBool(
          true,
          formatPowerfistLinkDetail(authoritative.pairedPowerfist.deviceId, authoritative.echoHost),
        )
      : linkFromBool(false, "Waiting for PowerFist code.");
  }

  const pfSession = await fetchPowerfistQrSession();
  const savedRemote = readPowerfistRemoteCredentials();
  if (pfSession.ok && pfSession.pairedRemote) {
    miragePowerfist = linkFromBool(
      true,
      `device ${pfSession.pairedRemote.deviceId.slice(0, 8)}…`,
    );
  } else if (savedRemote) {
    miragePowerfist = linkFromBool(
      false,
      `Saved hub device ${savedRemote.deviceId.slice(0, 8)}… — auto-reconnect pending.`,
    );
  }

  return {
    team: {
      echoMirage,
      echoPowerfist,
      miragePowerfist,
      echoHost: authoritative?.echoHost ?? echoHost,
      loading: false,
    },
    echo: authoritative,
    echoFetchFailedReason,
  };
}
