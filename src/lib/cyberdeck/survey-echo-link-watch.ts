"use client";

import { useCallback, useEffect, useState } from "react";
import { SURVEY_ECHO_LINK_CHANNEL } from "@/lib/cyberdeck/survey-mode";
import {
  clearSurveyMiragePairCredentials,
  clearSurveyPowerfistPairCredentials,
  ECHO_SURVEY_TERMINATED_MESSAGE,
  fetchEchoSurveyLinkStatus,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type SpyMiragePairCredentials,
  type SpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";

const LINK_POLL_MS = 2500;

type SpyEchoLinkRole = "mirage" | "powerfist";

function readCredentials(role: SpyEchoLinkRole): SpyMiragePairCredentials | SpyPowerfistPairCredentials | null {
  return role === "mirage" ? readSurveyMiragePairCredentials() : readSurveyPowerfistPairCredentials();
}

function clearCredentials(role: SpyEchoLinkRole): void {
  if (role === "mirage") {
    clearSurveyMiragePairCredentials();
  } else {
    clearSurveyPowerfistPairCredentials();
  }
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

  const handleTerminated = useCallback(
    (message: string) => {
      clearCredentials(role);
      setPaired(null);
      setTerminated(true);
      setTerminatedMessage(message);
    },
    [role],
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
    });

    if (!status.ok) return;

    if (!status.active) {
      handleTerminated(status.message);
    }
  }, [handleTerminated, role]);

  useEffect(() => {
    void pollLink();
    const interval = window.setInterval(() => void pollLink(), LINK_POLL_MS);

    const onBroadcast = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "echo-survey-terminated") {
        handleTerminated(ECHO_SURVEY_TERMINATED_MESSAGE);
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
      handleTerminated(ECHO_SURVEY_TERMINATED_MESSAGE);
    };
    window.addEventListener(SURVEY_ECHO_LINK_CHANNEL, onCustomEvent);

    return () => {
      window.clearInterval(interval);
      channel?.removeEventListener("message", onBroadcast);
      channel?.close();
      window.removeEventListener(SURVEY_ECHO_LINK_CHANNEL, onCustomEvent);
    };
  }, [handleTerminated, pollLink]);

  const resetLinkWatch = useCallback(() => {
    setTerminated(false);
    setTerminatedMessage(null);
    setPaired(readCredentials(role));
  }, [role]);

  return { paired, terminated, terminatedMessage, resetLinkWatch };
}
