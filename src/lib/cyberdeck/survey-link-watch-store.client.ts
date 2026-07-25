"use client";

import { ECHO_SURVEY_TERMINATED_MESSAGE } from "@/lib/cyberdeck/survey-mode";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  type SurveyMiragePairCredentials,
  type SurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { fetchEchoSurveyLinkStatus } from "@/lib/cyberdeck/survey-echo-status.client";

export const SURVEY_LINK_WATCH_CHANGED_EVENT = "echo-mirage-survey-link-watch-changed";

export type SurveyEchoLinkRole = "mirage" | "powerfist";

export type SurveyLinkWatchEntry = {
  role: SurveyEchoLinkRole;
  paired: SurveyMiragePairCredentials | SurveyPowerfistPairCredentials | null;
  terminated: boolean;
  terminatedMessage: string | null;
};

let mirageEntry: SurveyLinkWatchEntry = {
  role: "mirage",
  paired: null,
  terminated: false,
  terminatedMessage: null,
};

let powerfistEntry: SurveyLinkWatchEntry = {
  role: "powerfist",
  paired: null,
  terminated: false,
  terminatedMessage: null,
};

function readCredentials(
  role: SurveyEchoLinkRole,
): SurveyMiragePairCredentials | SurveyPowerfistPairCredentials | null {
  return role === "mirage" ? readSurveyMiragePairCredentials() : readSurveyPowerfistPairCredentials();
}

export function getSurveyLinkWatchEntry(role: SurveyEchoLinkRole): SurveyLinkWatchEntry {
  return role === "mirage" ? mirageEntry : powerfistEntry;
}

export function resetSurveyLinkWatchEntry(role: SurveyEchoLinkRole): void {
  const next: SurveyLinkWatchEntry = {
    role,
    paired: readCredentials(role),
    terminated: false,
    terminatedMessage: null,
  };
  if (role === "mirage") mirageEntry = next;
  else powerfistEntry = next;
  notifySurveyLinkWatchChanged();
}

export function notifySurveyLinkWatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_LINK_WATCH_CHANGED_EVENT));
}

export async function refreshSurveyLinkWatchEntry(
  role: SurveyEchoLinkRole,
  onStale?: (message: string) => void,
): Promise<void> {
  const creds = readCredentials(role);
  const previous = role === "mirage" ? mirageEntry : powerfistEntry;

  if (!creds) {
    const next: SurveyLinkWatchEntry = {
      role,
      paired: null,
      terminated: false,
      terminatedMessage: null,
    };
    if (role === "mirage") mirageEntry = next;
    else powerfistEntry = next;
    notifySurveyLinkWatchChanged();
    return;
  }

  const status = await fetchEchoSurveyLinkStatus({
    echoNodeId: creds.echoNodeId,
    role,
    sessionEpoch: creds.sessionEpoch ?? 0,
    nodeId: role === "mirage" ? (creds as SurveyMiragePairCredentials).nodeId : undefined,
    deviceId: role === "powerfist" ? (creds as SurveyPowerfistPairCredentials).deviceId : undefined,
    echoHost: creds.echoHost,
    httpPort: creds.httpPort,
  });

  if (!status.ok) {
    return;
  }

  if (!status.active) {
    const becameStale = !previous.terminated;
    const next: SurveyLinkWatchEntry = {
      role,
      paired: creds,
      terminated: true,
      terminatedMessage: status.message,
    };
    if (role === "mirage") mirageEntry = next;
    else powerfistEntry = next;
    notifySurveyLinkWatchChanged();
    if (becameStale) onStale?.(status.message);
    return;
  }

  const next: SurveyLinkWatchEntry = {
    role,
    paired: creds,
    terminated: false,
    terminatedMessage: null,
  };
  if (role === "mirage") mirageEntry = next;
  else powerfistEntry = next;
  notifySurveyLinkWatchChanged();
}

export async function refreshSurveyLinkWatch(onStale?: (message: string) => void): Promise<void> {
  await refreshSurveyLinkWatchEntry("mirage", onStale);
  await refreshSurveyLinkWatchEntry("powerfist", onStale);
}

export function markSurveyLinkWatchTerminated(role: SurveyEchoLinkRole, message: string): void {
  const creds = readCredentials(role);
  const next: SurveyLinkWatchEntry = {
    role,
    paired: creds,
    terminated: true,
    terminatedMessage: message,
  };
  if (role === "mirage") mirageEntry = next;
  else powerfistEntry = next;
  notifySurveyLinkWatchChanged();
}

export const SURVEY_LINK_TERMINATED_FALLBACK_MESSAGE = ECHO_SURVEY_TERMINATED_MESSAGE;
