"use client";

import { useCallback, useEffect, useState } from "react";
import { SURVEY_HUB_CONNECT_REQUEST_EVENT } from "@/lib/cyberdeck/survey-hub.client";
import { SURVEY_ECHO_LINK_CHANNEL } from "@/lib/cyberdeck/survey-mode";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  fetchEchoSurveyLinkStatus,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type SpyMiragePairCredentials,
  type SpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { traceSurveyPairing } from "@/lib/cyberdeck/survey-pairing-trace";

const LINK_POLL_MS = 2500;

function requestSurveyAutoReconnect(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_HUB_CONNECT_REQUEST_EVENT));
}

type SpyEchoLinkRole = "mirage" | "powerfist";

function readCredentials(role: SpyEchoLinkRole): SpyMiragePairCredentials | SpyPowerfistPairCredentials | null {
  return role === "mirage" ? readSurveyMiragePairCredentials() : readSurveyPowerfistPairCredentials();
}

export function useSurveyEchoLinkWatch(role: "mirage"): {
  paired: SpyMiragePairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSurveyEchoLinkWatch(role: "powerfist"): {
  paired: SpyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSurveyEchoLinkWatch(role: SpyEchoLinkRole): {
  paired: SpyMiragePairCredentials | SpyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
} {
  const [paired, setPaired] = useState(() => readCredentials(role));
  const [terminated, setTerminated] = useState(false);
  const [terminatedMessage, setTerminatedMessage] = useState<string | null>(null);

  const handleStaleLink = useCallback(
    (message: string) => {
      traceSurveyPairing(`Echo link stale — keeping saved creds for auto-reconnect · ${message}`);
      setTerminated(true);
      setTerminatedMessage(message);
      requestSurveyAutoReconnect();
    },
    [],
  );

  const pollLink = useCallback(async () => {
    const creds = readCredentials(role);
    if (!creds) {
      setPaired(null);
      return;
    }

    setPaired(creds);

    const status = await fetchEchoSurveyLinkStatus({
      echoNodeId: creds.echoNodeId,
      role,
      sessionEpoch: creds.sessionEpoch ?? 0,
      nodeId: role === "mirage" ? (creds as SpyMiragePairCredentials).nodeId : undefined,
      deviceId: role === "powerfist" ? (creds as SpyPowerfistPairCredentials).deviceId : undefined,
      echoHost: creds.echoHost,
      httpPort: creds.httpPort,
    });

    if (!status.ok) {
      traceSurveyPairing(`link poll skipped — ${status.reason}`);
      return;
    }

    if (!status.active) {
      handleStaleLink(status.message);
      return;
    }

    setTerminated(false);
    setTerminatedMessage(null);
  }, [handleStaleLink, role]);

  useEffect(() => {
    void pollLink();
    const interval = window.setInterval(() => void pollLink(), LINK_POLL_MS);

    const onBroadcast = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "echo-survey-terminated") {
        handleStaleLink(ECHO_SURVEY_TERMINATED_MESSAGE);
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SURVEY_ECHO_LINK_CHANNEL);
      channel.addEventListener("message", onBroadcast);
    } catch {
      /* BroadcastChannel unavailable */
    }

    const onCustomEvent = () => {
      handleStaleLink(ECHO_SURVEY_TERMINATED_MESSAGE);
    };
    window.addEventListener(SURVEY_ECHO_LINK_CHANNEL, onCustomEvent);

    return () => {
      window.clearInterval(interval);
      channel?.removeEventListener("message", onBroadcast);
      channel?.close();
      window.removeEventListener(SURVEY_ECHO_LINK_CHANNEL, onCustomEvent);
    };
  }, [handleStaleLink, pollLink]);

  const resetLinkWatch = useCallback(() => {
    setTerminated(false);
    setTerminatedMessage(null);
    setPaired(readCredentials(role));
  }, [role]);

  return { paired, terminated, terminatedMessage, resetLinkWatch };
}
