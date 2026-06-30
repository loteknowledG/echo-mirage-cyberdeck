"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPowerfistQrSession } from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  EMPTY_SPY_TEAM_STATUS,
  linkFromBool,
  SPY_TEAM_STATUS_CHANGED_EVENT,
  type SpyTeamStatus,
} from "@/lib/cyberdeck/spy-team-status";
import {
  fetchEchoSpyCodes,
  fetchEchoSpyLinkStatus,
  readSpyMiragePairCredentials,
  readSpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

const REFRESH_MS = 3000;

type RemoteEchoStatus =
  | {
      ok: true;
      echoHost: string;
      pairedMirage: { nodeId: string; pairedAt: string } | null;
      pairedPowerfist: { deviceId: string; pairedAt: string } | null;
    }
  | { ok: false; reason?: string };

async function fetchEchoRemoteStatus(echoHost: string, echoHttpPort: number): Promise<RemoteEchoStatus> {
  try {
    const params = new URLSearchParams({ echoHost, echoHttpPort: String(echoHttpPort) });
    const res = await fetch(`/api/spy/echo/remote-status?${params.toString()}`, { cache: "no-store" });
    return (await res.json()) as RemoteEchoStatus;
  } catch {
    return { ok: false, reason: "Could not reach Echo." };
  }
}

async function isLocalSpyLinkActive(
  role: "mirage" | "powerfist",
  creds: { echoNodeId: string; sessionEpoch: number; nodeId?: string; deviceId?: string },
): Promise<boolean> {
  const status = await fetchEchoSpyLinkStatus({
    echoNodeId: creds.echoNodeId,
    role,
    sessionEpoch: creds.sessionEpoch ?? 0,
    nodeId: role === "mirage" ? creds.nodeId : undefined,
    deviceId: role === "powerfist" ? creds.deviceId : undefined,
  });
  return status.ok && status.active;
}

export function useSpyTeamStatus(): SpyTeamStatus {
  const [status, setStatus] = useState<SpyTeamStatus>(EMPTY_SPY_TEAM_STATUS);

  const refresh = useCallback(async () => {
    const mirageCreds = readSpyMiragePairCredentials();
    const powerfistSpyCreds = readSpyPowerfistPairCredentials();
    const echoHost = mirageCreds?.echoHost ?? powerfistSpyCreds?.echoHost ?? null;
    const echoHttpPort = mirageCreds?.httpPort ?? powerfistSpyCreds?.httpPort ?? 3050;

    let echoMirage = linkFromBool(false, "Enter Mirage code on this machine.");
    let echoPowerfist = linkFromBool(false, "Enter PowerFist code on the phone.");
    let miragePowerfist = linkFromBool(false, "Scan Mirage hub phone QR on PowerFist.");

    const echoLocal = await fetchEchoSpyCodes();
    let remote: RemoteEchoStatus | null = null;

    if (echoLocal.ok) {
      echoMirage = echoLocal.pairedMirage
        ? linkFromBool(true, `node ${echoLocal.pairedMirage.nodeId.slice(0, 8)}…`)
        : linkFromBool(false, "Waiting for Mirage code.");
      echoPowerfist = echoLocal.pairedPowerfist
        ? linkFromBool(true, `device ${echoLocal.pairedPowerfist.deviceId.slice(0, 8)}…`)
        : linkFromBool(false, "Waiting for PowerFist code.");
    } else if (echoHost) {
      remote = await fetchEchoRemoteStatus(echoHost, echoHttpPort);
      if (remote.ok) {
        echoMirage = remote.pairedMirage
          ? linkFromBool(true, `node ${remote.pairedMirage.nodeId.slice(0, 8)}…`)
          : linkFromBool(false, "Echo has no Mirage pairing yet.");
        echoPowerfist = remote.pairedPowerfist
          ? linkFromBool(true, `device ${remote.pairedPowerfist.deviceId.slice(0, 8)}…`)
          : linkFromBool(false, "Echo has no PowerFist pairing yet.");
      }
    }

    if (mirageCreds) {
      const remoteMatches =
        remote?.ok && remote.pairedMirage?.nodeId === mirageCreds.nodeId;
      const localActive = echoLocal.ok ? await isLocalSpyLinkActive("mirage", mirageCreds) : false;

      if (remoteMatches || localActive || (!remote && !echoLocal.ok)) {
        echoMirage = linkFromBool(
          true,
          `${mirageCreds.echoHost} · node ${mirageCreds.nodeId.slice(0, 8)}…`,
        );
      } else if (remote?.ok && !remote.pairedMirage) {
        echoMirage = linkFromBool(false, "Re-enter Mirage code — Echo session may have reset.");
      }
    }

    if (powerfistSpyCreds) {
      const remoteMatches =
        remote?.ok && remote.pairedPowerfist?.deviceId === powerfistSpyCreds.deviceId;
      const localActive = echoLocal.ok
        ? await isLocalSpyLinkActive("powerfist", powerfistSpyCreds)
        : false;

      if (remoteMatches || localActive || (!remote && !echoLocal.ok)) {
        echoPowerfist = linkFromBool(
          true,
          `${powerfistSpyCreds.echoHost} · device ${powerfistSpyCreds.deviceId.slice(0, 8)}…`,
        );
      } else if (remote?.ok && !remote.pairedPowerfist) {
        echoPowerfist = linkFromBool(false, "Re-enter PowerFist code on the phone.");
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

  return status;
}
