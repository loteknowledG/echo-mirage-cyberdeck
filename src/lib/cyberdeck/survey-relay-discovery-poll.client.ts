"use client";

import { createBackgroundPoll } from "@/lib/client/background-poll.client";
import {
  isSurveyRelayPollingEnabled,
  isVercelDemoDeployment,
} from "@/lib/cyberdeck/survey-boundary";
import {
  ensureSurveyRelayEchoNodeId,
} from "@/lib/cyberdeck/survey-relay.client";
import { resolveSurveyRelayEchoNodeId } from "@/lib/cyberdeck/survey-deck-command.client";

const RELAY_DISCOVERY_INTERVAL_MS = 20_000;
const RELAY_DISCOVERY_DEMO_INTERVAL_MS = 60_000;

type RelayDiscoveryListener = (result: {
  ok: boolean;
  echoNodeId?: string;
  reason?: string;
}) => void;

const listeners = new Set<RelayDiscoveryListener>();

function notifyListeners(result: Parameters<RelayDiscoveryListener>[0]) {
  for (const listener of listeners) {
    listener(result);
  }
}

async function discoverRelayEchoNodeId(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  const result = await ensureSurveyRelayEchoNodeId(resolveSurveyRelayEchoNodeId());
  if (signal.aborted) return;
  if (result.ok) {
    notifyListeners({ ok: true, echoNodeId: result.echoNodeId });
    return;
  }
  notifyListeners({ ok: false, reason: result.reason });
}

export const surveyRelayDiscoveryPoll = createBackgroundPoll({
  id: "survey-relay-discovery",
  tick: discoverRelayEchoNodeId,
  getBaseIntervalMs: () =>
    isVercelDemoDeployment() ? RELAY_DISCOVERY_DEMO_INTERVAL_MS : RELAY_DISCOVERY_INTERVAL_MS,
  minIntervalMs: RELAY_DISCOVERY_DEMO_INTERVAL_MS,
  maxBackoffMs: 5 * 60_000,
  isEnabled: isSurveyRelayPollingEnabled,
});

export function subscribeSurveyRelayDiscovery(listener: RelayDiscoveryListener): () => void {
  listeners.add(listener);
  const unsub = surveyRelayDiscoveryPoll.subscribe();
  return () => {
    listeners.delete(listener);
    unsub();
  };
}
