"use client";

import { useCallback, useEffect, useState } from "react";
import { SPY_ECHO_LINK_CHANNEL } from "@/lib/cyberdeck/espionage-mode";
import {
  clearSpyMiragePairCredentials,
  clearSpyPowerfistPairCredentials,
  ECHO_SPY_TERMINATED_MESSAGE,
  fetchEchoSpyLinkStatus,
  readSpyMiragePairCredentials,
  readSpyPowerfistPairCredentials,
  type SpyMiragePairCredentials,
  type SpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

const LINK_POLL_MS = 2500;

type SpyEchoLinkRole = "mirage" | "powerfist";

function readCredentials(role: SpyEchoLinkRole): SpyMiragePairCredentials | SpyPowerfistPairCredentials | null {
  return role === "mirage" ? readSpyMiragePairCredentials() : readSpyPowerfistPairCredentials();
}

function clearCredentials(role: SpyEchoLinkRole): void {
  if (role === "mirage") {
    clearSpyMiragePairCredentials();
  } else {
    clearSpyPowerfistPairCredentials();
  }
}

export function useSpyEchoLinkWatch(role: "mirage"): {
  paired: SpyMiragePairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSpyEchoLinkWatch(role: "powerfist"): {
  paired: SpyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSpyEchoLinkWatch(role: SpyEchoLinkRole): {
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

    const status = await fetchEchoSpyLinkStatus({
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
      if (data?.type === "echo-spy-terminated") {
        handleTerminated(ECHO_SPY_TERMINATED_MESSAGE);
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SPY_ECHO_LINK_CHANNEL);
      channel.addEventListener("message", onBroadcast);
    } catch {
      /* BroadcastChannel unavailable */
    }

    const onCustomEvent = () => {
      handleTerminated(ECHO_SPY_TERMINATED_MESSAGE);
    };
    window.addEventListener(SPY_ECHO_LINK_CHANNEL, onCustomEvent);

    return () => {
      window.clearInterval(interval);
      channel?.removeEventListener("message", onBroadcast);
      channel?.close();
      window.removeEventListener(SPY_ECHO_LINK_CHANNEL, onCustomEvent);
    };
  }, [handleTerminated, pollLink]);

  const resetLinkWatch = useCallback(() => {
    setTerminated(false);
    setTerminatedMessage(null);
    setPaired(readCredentials(role));
  }, [role]);

  return { paired, terminated, terminatedMessage, resetLinkWatch };
}
