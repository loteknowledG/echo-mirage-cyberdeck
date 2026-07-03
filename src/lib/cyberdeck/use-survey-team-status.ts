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
    let miragePowerfist = linkFromBool(false, "Scan Mirage hub phone QR on PowerFist.");

    const echoLocal = await fetchEchoSurveyStatus();
    let remote: EchoSurveyStatus | { ok: false; reason?: string } | null = null;

    if (echoLocal.ok) {
      const localMirages = normalizePairedMirages(echoLocal);
      echoMirage = localMirages.length
        ? linkFromBool(true, formatMirageLinkDetail(localMirages))
        : linkFromBool(false, "Waiting for Mirage code.");
      echoPowerfist = echoLocal.pairedPowerfist
        ? linkFromBool(true, `device ${echoLocal.pairedPowerfist.deviceId.slice(0, 8)}…`)
        : linkFromBool(false, "Waiting for PowerFist code.");
    } else if (legacyPairing && echoHost) {
      remote = await fetchEchoRemoteSurveyStatusClient(echoHost, echoHttpPort);
      if (remote.ok) {
        const remoteMirages = normalizePairedMirages(remote);
        echoMirage = remoteMirages.length
          ? linkFromBool(true, formatMirageLinkDetail(remoteMirages))
          : linkFromBool(false, "Echo has no Mirage pairing yet.");
        echoPowerfist = remote.pairedPowerfist
          ? linkFromBool(true, `device ${remote.pairedPowerfist.deviceId.slice(0, 8)}…`)
          : linkFromBool(false, "Echo has no PowerFist pairing yet.");
      }
    }

    if (legacyPairing && mirageCreds) {
      const linkActive = await isSpyLinkActive("mirage", mirageCreds);
      echoMirage = linkFromBool(
        linkActive !== false,
        linkActive === false
          ? "Re-enter Mirage code — Echo session may have reset."
          : `${mirageCreds.echoHost} · node ${mirageCreds.nodeId.slice(0, 8)}…`,
      );
    }

    if (legacyPairing && powerfistSpyCreds) {
      const linkActive = await isSpyLinkActive("powerfist", powerfistSpyCreds);
      echoPowerfist = linkFromBool(
        linkActive !== false,
        linkActive === false
          ? "Re-enter PowerFist code on the phone."
          : `${powerfistSpyCreds.echoHost} · device ${powerfistSpyCreds.deviceId.slice(0, 8)}…`,
      );
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
      echoHost: echoLocal.ok ? echoLocal.echoHost : echoHost,
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
