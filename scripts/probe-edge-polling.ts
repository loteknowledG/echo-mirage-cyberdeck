import assert from "node:assert/strict";

import { createBackgroundPoll, type BackgroundPollEnvironment } from "../src/lib/client/background-poll.client";
import { SURVEY_LISTENING_MIN_POLL_MS } from "../src/lib/cyberdeck/survey-listening.client";
import {
  resolveSurveyTeamPollIntervalMs,
  SURVEY_TEAM_PAIRING_POLL_MS,
  SURVEY_TEAM_SETTLED_POLL_MS,
  type SurveyTeamLinkState,
  type SurveyTeamStatus,
} from "../src/lib/cyberdeck/survey-team-status";

type FakeEnvOptions = {
  hidden?: boolean;
};

function createFakeEnv(options: FakeEnvOptions = {}): BackgroundPollEnvironment & {
  setHidden: (hidden: boolean) => void;
  pending: Array<{ id: number; dueAt: number; fn: () => void }>;
  nowMs: number;
  tickTimers: () => void;
} {
  let hidden = options.hidden ?? false;
  const state = { nowMs: 0 };
  let nextTimerId = 1;
  const pending: Array<{ id: number; dueAt: number; fn: () => void }> = [];
  const visibilityListeners = new Set<() => void>();

  return {
    pending,
    get nowMs() {
      return state.nowMs;
    },
    set nowMs(value: number) {
      state.nowMs = value;
    },
    setHidden(next: boolean) {
      hidden = next;
      for (const listener of visibilityListeners) listener();
    },
    now: () => state.nowMs,
    setTimeout: (fn, ms) => {
      const id = nextTimerId++;
      pending.push({ id, dueAt: state.nowMs + ms, fn });
      pending.sort((a, b) => a.dueAt - b.dueAt);
      return id;
    },
    clearTimeout: (id) => {
      const index = pending.findIndex((entry) => entry.id === id);
      if (index >= 0) pending.splice(index, 1);
    },
    isDocumentHidden: () => hidden,
    addVisibilityListener: (listener) => {
      visibilityListeners.add(listener);
      return () => visibilityListeners.delete(listener);
    },
    tickTimers: () => {
      while (pending.length > 0 && pending[0].dueAt <= state.nowMs) {
        const [entry] = pending.splice(0, 1);
        entry.fn();
      }
    },
  };
}

async function flushMicrotasks(count = 8) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

async function testSharedPollingLoop() {
  let tickCount = 0;
  const env = createFakeEnv();
  const poll = createBackgroundPoll({
    id: "probe-shared",
    tick: async () => {
      tickCount += 1;
    },
    getBaseIntervalMs: () => 5_000,
    env,
  });

  const unsubA = poll.subscribe();
  const unsubB = poll.subscribe();
  const unsubC = poll.subscribe();

  assert.equal(poll.getSubscriberCount(), 3);
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(tickCount, 1);

  unsubA();
  unsubB();
  assert.equal(poll.getSubscriberCount(), 1);
  env.nowMs += 5_000;
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(tickCount, 2);

  unsubC();
  assert.equal(poll.getSubscriberCount(), 0);
  assert.equal(poll.getState().running, false);
}

async function testHiddenPausesPolling() {
  let tickCount = 0;
  const env = createFakeEnv({ hidden: true });
  const poll = createBackgroundPoll({
    id: "probe-hidden",
    tick: async () => {
      tickCount += 1;
    },
    getBaseIntervalMs: () => 1_000,
    env,
  });

  const unsub = poll.subscribe();
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(tickCount, 0);
  assert.equal(poll.getState().hiddenPaused, true);

  env.setHidden(false);
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(tickCount, 1);

  env.setHidden(true);
  env.nowMs += 1_000;
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(tickCount, 1);

  unsub();
}

async function testErrorBackoff() {
  let attempts = 0;
  const env = createFakeEnv();
  const poll = createBackgroundPoll({
    id: "probe-backoff",
    tick: async () => {
      attempts += 1;
      throw new Error("network");
    },
    getBaseIntervalMs: () => 1_000,
    maxBackoffMs: 8_000,
    env,
  });

  const unsub = poll.subscribe();
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(attempts, 1);
  assert.equal(poll.getState().consecutiveErrors, 1);

  const firstNext = poll.__getNextTickAt();
  assert.ok(firstNext != null);
  assert.ok(firstNext! - env.nowMs >= 1_000);

  env.nowMs += 5_000;
  env.tickTimers();
  await flushMicrotasks();
  assert.equal(attempts, 2);
  assert.equal(poll.getState().consecutiveErrors, 2);

  const secondNext = poll.__getNextTickAt();
  assert.ok(secondNext != null);
  assert.ok(secondNext! - env.nowMs >= 2_000);

  unsub();
}

async function testAbortOnLastUnsubscribe() {
  let aborted = false;
  const env = createFakeEnv();
  const poll = createBackgroundPoll({
    id: "probe-abort",
    tick: async (signal) => {
      await new Promise<void>((resolve) => {
        if (signal.aborted) {
          aborted = true;
          resolve();
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve();
          },
          { once: true },
        );
      });
    },
    getBaseIntervalMs: () => 30_000,
    env,
  });

  const unsub = poll.subscribe();
  env.tickTimers();
  await flushMicrotasks();
  unsub();
  await flushMicrotasks();
  assert.equal(aborted, true);
  assert.equal(poll.getState().running, false);
}

function surveyTeamStatus(
  loading: boolean,
  echoMirage: SurveyTeamLinkState,
  echoPowerfist: SurveyTeamLinkState,
  miragePowerfist: SurveyTeamLinkState,
): SurveyTeamStatus {
  const link = (state: SurveyTeamLinkState) => ({ state, detail: null });
  return {
    loading,
    echoMirage: link(echoMirage),
    echoPowerfist: link(echoPowerfist),
    miragePowerfist: link(miragePowerfist),
    echoHost: null,
  };
}

function testSurveyTeamPollingCadence() {
  const cases: Array<{ name: string; team: SurveyTeamStatus; expected: number }> = [
    {
      name: "loading",
      team: surveyTeamStatus(true, "linked", "linked", "linked"),
      expected: SURVEY_TEAM_PAIRING_POLL_MS,
    },
    {
      name: "unknown echo-mirage",
      team: surveyTeamStatus(false, "unknown", "linked", "linked"),
      expected: SURVEY_TEAM_PAIRING_POLL_MS,
    },
    {
      name: "unknown echo-powerfist",
      team: surveyTeamStatus(false, "linked", "unknown", "linked"),
      expected: SURVEY_TEAM_PAIRING_POLL_MS,
    },
    {
      name: "unknown mirage-powerfist",
      team: surveyTeamStatus(false, "linked", "linked", "unknown"),
      expected: SURVEY_TEAM_PAIRING_POLL_MS,
    },
    {
      name: "offline teammate is settled",
      team: surveyTeamStatus(false, "linked", "not-linked", "linked"),
      expected: SURVEY_TEAM_SETTLED_POLL_MS,
    },
    {
      name: "terminated teammate is settled",
      team: surveyTeamStatus(false, "linked", "terminated", "not-linked"),
      expected: SURVEY_TEAM_SETTLED_POLL_MS,
    },
    {
      name: "triple linked is settled",
      team: surveyTeamStatus(false, "linked", "linked", "linked"),
      expected: SURVEY_TEAM_SETTLED_POLL_MS,
    },
  ];

  for (const testCase of cases) {
    assert.equal(
      resolveSurveyTeamPollIntervalMs(testCase.team),
      testCase.expected,
      testCase.name,
    );
  }
}

function testListeningMinimumInterval() {
  assert.ok(SURVEY_LISTENING_MIN_POLL_MS >= 5_000);
  assert.notEqual(SURVEY_LISTENING_MIN_POLL_MS, 300);
}

async function main() {
  await testSharedPollingLoop();
  await testHiddenPausesPolling();
  await testErrorBackoff();
  await testAbortOnLastUnsubscribe();
  testSurveyTeamPollingCadence();
  testListeningMinimumInterval();
  console.log("[probe:edge-polling] ok");
}

void main().catch((error) => {
  console.error("[probe:edge-polling] failed", error);
  process.exitCode = 1;
});
