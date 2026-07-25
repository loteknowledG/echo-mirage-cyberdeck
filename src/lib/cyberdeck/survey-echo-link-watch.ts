"use client";

import { useCallback, useEffect, useState } from "react";
import { requestSurveyHubConnect } from "@/lib/cyberdeck/survey-connect-request.client";
import { SURVEY_ECHO_LINK_CHANNEL } from "@/lib/cyberdeck/survey-mode";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type SurveyMiragePairCredentials,
  type SurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import {
  getSurveyLinkWatchEntry,
  markSurveyLinkWatchTerminated,
  resetSurveyLinkWatchEntry,
  SURVEY_LINK_WATCH_CHANGED_EVENT,
} from "@/lib/cyberdeck/survey-link-watch-store.client";
import { subscribeSurveyTeamStatusPoll } from "@/lib/cyberdeck/survey-team-status-poll.client";

type SurveyEchoLinkRole = "mirage" | "powerfist";

function readCredentials(
  role: SurveyEchoLinkRole,
): SurveyMiragePairCredentials | SurveyPowerfistPairCredentials | null {
  return role === "mirage" ? readSurveyMiragePairCredentials() : readSurveyPowerfistPairCredentials();
}

export function useSurveyEchoLinkWatch(role: "mirage"): {
  paired: SurveyMiragePairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSurveyEchoLinkWatch(role: "powerfist"): {
  paired: SurveyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
};
export function useSurveyEchoLinkWatch(role: SurveyEchoLinkRole): {
  paired: SurveyMiragePairCredentials | SurveyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
  resetLinkWatch: () => void;
} {
  const [entry, setEntry] = useState(() => getSurveyLinkWatchEntry(role));

  const sync = useCallback(() => {
    setEntry(getSurveyLinkWatchEntry(role));
  }, [role]);

  const handleStaleLink = useCallback((message: string) => {
    markSurveyLinkWatchTerminated(role, message);
    requestSurveyHubConnect({ force: true });
    sync();
  }, [role, sync]);

  useEffect(() => {
    sync();
    const unsubPoll = subscribeSurveyTeamStatusPoll(sync);
    const onChanged = () => sync();
    window.addEventListener(SURVEY_LINK_WATCH_CHANGED_EVENT, onChanged);

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
      unsubPoll();
      window.removeEventListener(SURVEY_LINK_WATCH_CHANGED_EVENT, onChanged);
      channel?.removeEventListener("message", onBroadcast);
      channel?.close();
      window.removeEventListener(SURVEY_ECHO_LINK_CHANNEL, onCustomEvent);
    };
  }, [handleStaleLink, role, sync]);

  const resetLinkWatch = useCallback(() => {
    resetSurveyLinkWatchEntry(role);
    sync();
  }, [role, sync]);

  return {
    paired: entry.paired ?? readCredentials(role),
    terminated: entry.terminated,
    terminatedMessage: entry.terminatedMessage,
    resetLinkWatch,
  };
}
