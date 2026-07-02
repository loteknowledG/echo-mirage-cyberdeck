"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";
import { getOrCreateSurveyNodeId } from "@/lib/cyberdeck/survey-mode";
import { getOrCreatePowerfistDeviceId } from "@/lib/cyberdeck/survey-pairing-client";
import { notifySurveyPairingDebug } from "@/lib/cyberdeck/survey-pairing-debug";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import {
  SURVEY_PAIRING_BUNDLE_EVENT,
  SURVEY_TEAM_SOCKET_PATH,
  SURVEY_TEAM_SOCKET_STATUS_EVENT,
  type SurveyPairingBundlePush,
  type SurveyTeamLinkedNotice,
  type SurveyTeamRoster,
  type SurveyTeamSocketRole,
  type SurveyTeamSocketStatus,
} from "@/lib/cyberdeck/survey-team-socket-types";

function surveyTeamSocketUrl(echoHost: string, httpPort: number): string {
  const host = echoHost.trim();
  if (!host) return "";
  if (/^https?:\/\//i.test(host)) {
    return host.replace(/\/$/, "");
  }
  return `http://${host}:${httpPort}`;
}

function dispatchPairingBundle(bundle: SurveyPairingBundlePush): void {
  window.dispatchEvent(new CustomEvent(SURVEY_PAIRING_BUNDLE_EVENT, { detail: bundle }));
}

function dispatchSocketStatus(status: SurveyTeamSocketStatus, roster: SurveyTeamRoster | null): void {
  window.dispatchEvent(
    new CustomEvent(SURVEY_TEAM_SOCKET_STATUS_EVENT, {
      detail: { status, roster },
    }),
  );
}

export type UseSurveyTeamSocketOptions = {
  role: SurveyTeamSocketRole;
  echoHost: string | null;
  httpPort?: number;
  enabled?: boolean;
};

export type UseSurveyTeamSocketResult = {
  status: SurveyTeamSocketStatus;
  roster: SurveyTeamRoster | null;
  lastBundle: SurveyPairingBundlePush | null;
};

export function useSurveyTeamSocket(options: UseSurveyTeamSocketOptions): UseSurveyTeamSocketResult {
  const { role, echoHost, httpPort = DEFAULT_ECHO_HTTP_PORT, enabled = true } = options;
  const [status, setStatus] = useState<SurveyTeamSocketStatus>("idle");
  const [roster, setRoster] = useState<SurveyTeamRoster | null>(null);
  const [lastBundle, setLastBundle] = useState<SurveyPairingBundlePush | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const host = echoHost?.trim() ?? "";
    if (!enabled || !host) {
      setStatus("disabled");
      setRoster(null);
      dispatchSocketStatus("disabled", null);
      return;
    }

    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      setStatus("disabled");
      dispatchSocketStatus("disabled", null);
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async () => {
      setStatus("connecting");
      dispatchSocketStatus("connecting", null);
      notifySurveyPairingDebug(`team socket connecting · ${host}:${httpPort}`);

      const { io } = await import("socket.io-client");
      if (cancelled) return;

      const url = surveyTeamSocketUrl(host, httpPort);
      socket = io(url, {
        path: SURVEY_TEAM_SOCKET_PATH,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 8,
        timeout: 12_000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (cancelled) return;
        setStatus("connected");
        notifySurveyPairingDebug(`team socket connected · ${url}`);
        socket?.emit("survey:join", {
          role,
          nodeId: role === "mirage" ? getOrCreateSurveyNodeId() : undefined,
          deviceId: role === "powerfist" ? getOrCreatePowerfistDeviceId() : undefined,
        });
      });

      socket.on("survey:joined", (payload: SurveyTeamRoster) => {
        if (cancelled) return;
        setRoster(payload);
        dispatchSocketStatus("connected", payload);
      });

      socket.on("survey:team-status", (payload: SurveyTeamRoster) => {
        if (cancelled) return;
        setRoster(payload);
        dispatchSocketStatus("connected", payload);
        notifySurveyTeamStatusChanged();
      });

      socket.on("survey:pairing-bundle", (payload: SurveyPairingBundlePush) => {
        if (cancelled || role !== "mirage") return;
        setLastBundle(payload);
        dispatchPairingBundle(payload);
        notifySurveyPairingDebug(
          `pairing bundle received · ${payload.echoHost}:${payload.httpPort} · pin ${payload.miragePin}`,
        );
      });

      socket.on("survey:linked", (_payload: SurveyTeamLinkedNotice) => {
        if (cancelled) return;
        notifySurveyTeamStatusChanged();
      });

      socket.on("connect_error", (error: Error) => {
        if (cancelled) return;
        setStatus("error");
        dispatchSocketStatus("error", null);
        notifySurveyPairingDebug(`team socket error — ${error.message}`);
      });

      socket.on("disconnect", () => {
        if (cancelled) return;
        setStatus("connecting");
        dispatchSocketStatus("connecting", roster);
      });
    };

    void connect();

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [role, echoHost, httpPort, enabled]);

  return { status, roster, lastBundle };
}
