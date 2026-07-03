"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPowerfistQrSession } from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  EMPTY_SPY_TEAM_STATUS,
  linkFromBool,
  SPY_TEAM_STATUS_CHANGED_EVENT,
  type SurveyTeamStatus,
} from "@/lib/cyberdeck/survey-team-status";
import {
  fetchEchoRemoteSurveyStatusClient,
  fetchEchoSurveyStatus,
  fetchEchoSurveyLinkStatus,
  normalizePairedMirages,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type EchoSurveyStatus,
} from "@/lib/cyberdeck/survey-pairing-client";
import { isSurveyLegacyPairingEnabled } from "@/lib/cyberdeck/survey-boundary";

const REFRESH_MS = 3000;

function formatMirageLinkDetail(mirages: { nodeId: string }[]): string {
  if (mirages.length === 0) return "Waiting for Mirage code.";
  if (mirages.length === 1) return `node ${mirages[0].nodeId.slice(0, 8)}…`;
  return `${mirages.length} linked · ${mirages.map((mirage) => mirage.nodeId.slice(0, 8)).join(", ")}…`;
}

async function isSpyLinkActive(
  role: "mirage" | "powerfist",
  creds: {
    echoHost: string;
    httpPort: number;
    echoNodeId: string;
    sessionEpoch: number;
    nodeId?: string;
    deviceId?: string;
  },
): Promise<boolean | null> {
  const status = await fetchEchoSurveyLinkStatus({
    echoNodeId: creds.echoNodeId,
    role,
    sessionEpoch: creds.sessionEpoch ?? 0,
    nodeId: role === "mirage" ? creds.nodeId : undefined,
    deviceId: role === "powerfist" ? creds.deviceId : undefined,
    echoHost: creds.echoHost,
    httpPort: creds.httpPort,
  });
  if (!status.ok) return null;
  return status.active;
}

function formatPowerfistLinkDetail(deviceId: string, echoHost?: string | null): string {
  const prefix = echoHost ? `${echoHost} · ` : "";
  return `${prefix}device ${deviceId.slice(0, 8)}…`;
}

async function fetchAuthoritativeEchoStatus(input: {
  echoHost: string | null;
  echoHttpPort: number;
  legacyPairing: boolean;
}): Promise<EchoSurveyStatus | null> {
  const echoLocal = await fetchEchoSurveyStatus();
  if (echoLocal.ok) return echoLocal;

  if (!input.legacyPairing || !input.echoHost) return null;

  const remote = await fetchEchoRemoteSurveyStatusClient(input.echoHost, input.echoHttpPort);
  return remote.ok ? remote : null;
}

export function useSurveyTeamStatus(): SurveyTeamStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<SurveyTeamStatus>(EMPTY_SPY_TEAM_STATUS);

  const refresh = useCallback(async () => {
    const legacyPairing = isSurveyLegacyPairingEnabled();
    const mirageCreds = readSurveyMiragePairCredentials();
    const powerfistSpyCreds = readSurveyPowerfistPairCredentials();
    const echoHost = mirageCreds?.echoHost ?? powerfistSpyCreds?.echoHost ?? null;
    const echoHttpPort = mirageCreds?.httpPort ?? powerfistSpyCreds?.httpPort ?? 3050;

    let echoMirage = linkFromBool(false, "Enter Mirage code on this machine.");
    let echoPowerfist = linkFromBool(false, "Enter PowerFist code on the phone.");
    let miragePowerfist = linkFromBool(
      false,
      "Enter Mirage hub code on PowerFist tab, or scan hub QR.",
    );

    const authoritative = await fetchAuthoritativeEchoStatus({
      echoHost,
      echoHttpPort,
      legacyPairing,
    });

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

    if (legacyPairing && mirageCreds) {
      const linkActive = await isSpyLinkActive("mirage", mirageCreds);
      if (linkActive === false) {
        echoMirage = linkFromBool(false, "Re-enter Mirage code — Echo session may have reset.");
      } else {
        echoMirage = linkFromBool(
          echoMirage.state === "linked" || linkActive === true,
          `${mirageCreds.echoHost} · node ${mirageCreds.nodeId.slice(0, 8)}…`,
        );
      }
    }

    if (legacyPairing && powerfistSpyCreds) {
      const linkActive = await isSpyLinkActive("powerfist", powerfistSpyCreds);
      if (linkActive === false) {
        echoPowerfist = linkFromBool(false, "Re-enter PowerFist code on the phone.");
      } else {
        echoPowerfist = linkFromBool(
          echoPowerfist.state === "linked" || linkActive === true,
          formatPowerfistLinkDetail(powerfistSpyCreds.deviceId, powerfistSpyCreds.echoHost),
        );
      }
    }

    const pfSession = await fetchPowerfistQrSession();
    if (pfSession.ok && pfSession.pairedRemote) {
      miragePowerfist = linkFromBool(
        true,
        `device ${pfSession.pairedRemote.deviceId.slice(0, 8)}…`,
      );
    }

    setStatus({
      echoMirage,
      echoPowerfist,
      miragePowerfist,
      echoHost: authoritative?.echoHost ?? echoHost,
      loading: false,
    });
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    const onChanged = () => void refresh();
    window.addEventListener(SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(SPY_TEAM_STATUS_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  return { ...status, refresh };
}
