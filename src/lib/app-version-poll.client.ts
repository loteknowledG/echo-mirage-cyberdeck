"use client";

import { createBackgroundPoll } from "@/lib/client/background-poll.client";
import { checkForAppUpdate, shouldPollForAppUpdates } from "@/lib/app-update-client";

export const APP_VERSION_POLL_MS = 45 * 60_000;

export const appVersionPoll = createBackgroundPoll({
  id: "app-version",
  tick: async () => {
    await checkForAppUpdate();
  },
  getBaseIntervalMs: () => APP_VERSION_POLL_MS,
  minIntervalMs: 30 * 60_000,
  maxBackoffMs: 60 * 60_000,
  isEnabled: shouldPollForAppUpdates,
});

export function subscribeAppVersionPoll(onNotify?: () => void): () => void {
  if (!shouldPollForAppUpdates()) return () => undefined;
  return appVersionPoll.subscribe(onNotify);
}
