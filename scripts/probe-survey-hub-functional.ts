/**
 * Functional probes for Survey Hub — run before/after each refactor step:
 *   pnpm probe:survey-hub
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSurveyAutoConnectIntent } from "../src/lib/cyberdeck/survey-auto-connect-intent";
import {
  formatSurveyAutoPairResultForMuthur,
  formatSurveyHubResultForMuthur,
  SURVEY_HUB_CONNECT_REQUEST_EVENT,
  SURVEY_HUB_CONNECT_RESULT_EVENT,
  type SurveyHubConnectResult,
} from "../src/lib/cyberdeck/survey-hub-connect-events";
import {
  isSurveyTeamTripleLinked,
  linkFromBool,
  EMPTY_SPY_TEAM_STATUS,
} from "../src/lib/cyberdeck/survey-team-status";
import {
  applySurveyTeamStatusSnapshot,
  getSurveyTeamStatusSnapshot,
  isSurveyTripleLinkedSync,
} from "../src/lib/cyberdeck/survey-team-status-store.client";
import { normalizePairedMirages } from "../src/lib/cyberdeck/survey-echo-status.client";
import { resolveSurveyHubTeamId, saveSurveyHubTeamId } from "../src/lib/cyberdeck/survey-hub-store.client";

function probeAutoConnectIntent(): void {
  assert.equal(parseSurveyAutoConnectIntent("connect team links"), true);
  assert.equal(parseSurveyAutoConnectIntent("muthur, connect mirage to powerfist"), true);
  assert.equal(parseSurveyAutoConnectIntent("survey auto connect"), true);
  assert.equal(parseSurveyAutoConnectIntent("/survey connect"), true);
  assert.equal(parseSurveyAutoConnectIntent("link echo and mirage for survey"), true);
  assert.equal(parseSurveyAutoConnectIntent("hello world"), false);
  assert.equal(parseSurveyAutoConnectIntent(""), false);
}

function probeTripleLinkStatus(): void {
  assert.equal(isSurveyTeamTripleLinked({ ...EMPTY_SPY_TEAM_STATUS, loading: true }), false);

  const allGreen = {
    echoMirage: linkFromBool(true, "mirage"),
    echoPowerfist: linkFromBool(true, "powerfist"),
    miragePowerfist: linkFromBool(true, "hub"),
    loading: false,
  };
  assert.equal(isSurveyTeamTripleLinked(allGreen), true);

  const partial = {
    ...allGreen,
    echoPowerfist: linkFromBool(false, "waiting"),
  };
  assert.equal(isSurveyTeamTripleLinked(partial), false);
}

function probeTripleLinkStore(): void {
  applySurveyTeamStatusSnapshot({ ...EMPTY_SPY_TEAM_STATUS, loading: true });
  assert.equal(isSurveyTripleLinkedSync(), false);

  applySurveyTeamStatusSnapshot({
    echoMirage: linkFromBool(true, "mirage"),
    echoPowerfist: linkFromBool(true, "powerfist"),
    miragePowerfist: linkFromBool(true, "hub"),
    echoHost: "127.0.0.1",
    loading: false,
  });
  assert.equal(isSurveyTripleLinkedSync(), true);
  assert.equal(getSurveyTeamStatusSnapshot().echoHost, "127.0.0.1");
}

function probeHubUsesSharedTripleLinkProbe(): void {
  const hubSource = readFileSync(resolve("src/lib/cyberdeck/survey-hub.client.ts"), "utf8");
  assert.ok(
    !hubSource.includes("mirageEchoLinkActive(),\n    powerfistEchoLinkActive(),\n    mirageHubLinkActive()"),
    "survey-hub.client must not implement its own triple-link probe",
  );
  assert.ok(
    hubSource.includes("survey-team-status-store.client"),
    "survey-hub.client must use shared triple-link store",
  );

  const probeSource = readFileSync(resolve("src/lib/cyberdeck/survey-team-status-probe.client.ts"), "utf8");
  assert.ok(
    probeSource.includes("export async function probeSurveyTeamStatus"),
    "shared team status probe must exist",
  );

  const hookSource = readFileSync(resolve("src/lib/cyberdeck/use-survey-team-status.ts"), "utf8");
  assert.ok(
    hookSource.includes("probeSurveyTeamStatus"),
    "useSurveyTeamStatus must use shared probe",
  );
  assert.ok(
    !hookSource.includes("fetchEchoSurveyLinkStatus"),
    "useSurveyTeamStatus must not duplicate link probe logic",
  );

  const panelSource = readFileSync(resolve("src/components/cyberdeck/survey-hub-panel.tsx"), "utf8");
  assert.ok(
    !panelSource.includes("isSurveyTripleLinked"),
    "SurveyHubPanel must rely on hook triple-link state only",
  );
}

function probeSurveyPairingSplit(): void {
  const barrel = readFileSync(resolve("src/lib/cyberdeck/survey-pairing-client.ts"), "utf8");
  assert.ok(barrel.includes("survey-pair-credentials.client"), "pairing barrel re-exports credentials");
  assert.ok(barrel.includes("survey-echo-status.client"), "pairing barrel re-exports echo status");
  assert.ok(barrel.includes("survey-pair-enter.client"), "pairing barrel re-exports pair enter");
  assert.ok(barrel.includes("survey-session.client"), "pairing barrel re-exports session");
  assert.ok(
    !barrel.includes("async function readEchoSurveyPayload"),
    "pairing barrel must not contain inline status fetch logic",
  );
  assert.deepEqual(normalizePairedMirages({ pairedMirage: { nodeId: "n1", pairedAt: "t" } }), [
    { nodeId: "n1", pairedAt: "t" },
  ]);
}

function probePreviewMatrixSplit(): void {
  const matrix = readFileSync(resolve("src/app/preview/preview-matrix.tsx"), "utf8");
  assert.ok(matrix.includes("preview-matrix-play"), "preview-matrix must import play helpers");
  assert.ok(matrix.includes("use-powerfist-matrix-remote"), "preview-matrix must import remote hook");
  assert.ok(
    !matrix.includes("function cardChatMessage"),
    "preview-matrix must not inline cardChatMessage",
  );
  assert.ok(
    !matrix.includes("connectPowerfistRemoteSocket"),
    "preview-matrix must not inline remote socket wiring",
  );

  const play = readFileSync(resolve("src/app/preview/preview-matrix-play.ts"), "utf8");
  assert.ok(play.includes("CARD_PLAY_LAPS = 2"), "play module owns card arm timing");
}

function probeHubResultFormatting(): void {
  const skipped: SurveyHubConnectResult = { ran: false, skipped: "Hub disabled.", steps: [] };
  assert.match(formatSurveyHubResultForMuthur(skipped), /SKIPPED/);

  const ok: SurveyHubConnectResult = {
    ran: true,
    echoNodeId: "team-abc",
    steps: [
      { id: "mirage", ok: true, detail: "linked" },
      { id: "powerfist-echo", ok: true, detail: "linked" },
      { id: "powerfist-hub", ok: true, detail: "linked" },
    ],
  };
  const text = formatSurveyHubResultForMuthur(ok);
  assert.match(text, /CONNECTED/);
  assert.match(text, /TEAM ID/);
  assert.match(text, /MIRAGE \/\/ OK/);

  assert.equal(formatSurveyAutoPairResultForMuthur(ok), text);
}

function probeTeamIdStore(): void {
  const storage = new Map<string, string>();
  const g = globalThis as typeof globalThis & {
    window?: Window & typeof globalThis;
    localStorage?: Storage;
  };
  g.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };
  g.window = g as unknown as Window & typeof globalThis;

  saveSurveyHubTeamId("echo-node-123");
  assert.equal(resolveSurveyHubTeamId(), "echo-node-123");
  assert.equal(resolveSurveyHubTeamId("override-id"), "override-id");
}

async function probeConnectEventBridge(): Promise<void> {
  const { requestSurveyHubConnectAndWait } = await import(
    "../src/lib/cyberdeck/survey-connect-request.client"
  );

  const target = new EventTarget();
  const g = globalThis as typeof globalThis & { window?: Window & typeof globalThis };
  g.window = Object.assign(target, {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  }) as unknown as Window & typeof globalThis;

  const expected: SurveyHubConnectResult = {
    ran: true,
    steps: [{ id: "mirage", ok: true, detail: "test" }],
  };

  let requestSeen = false;
  target.addEventListener(SURVEY_HUB_CONNECT_REQUEST_EVENT, () => {
    requestSeen = true;
    target.dispatchEvent(
      new CustomEvent(SURVEY_HUB_CONNECT_RESULT_EVENT, { detail: expected }),
    );
  });

  const result = await requestSurveyHubConnectAndWait({ force: true, timeoutMs: 2_000 });
  assert.equal(requestSeen, true);
  assert.deepEqual(result, expected);
}

function probeCyberdeckAppBoundary(): void {
  const appPath = resolve("src/features/cyberdeck/cyberdeck-app.tsx");
  const source = readFileSync(appPath, "utf8");

  assert.ok(
    !source.includes("runSurveyAutoPair"),
    "cyberdeck-app must not call runSurveyAutoPair directly",
  );
  assert.ok(
    !source.includes("runSurveyHubConnect"),
    "cyberdeck-app must not call runSurveyHubConnect directly",
  );
  assert.ok(
    !source.includes("survey-hub.client"),
    "cyberdeck-app must not import survey-hub.client",
  );
  assert.ok(
    !source.includes("survey-auto-pair.client"),
    "cyberdeck-app must not import survey-auto-pair.client",
  );
  assert.ok(
    source.includes("requestSurveyHubConnectAndWait"),
    "cyberdeck-app must use requestSurveyHubConnectAndWait",
  );
  assert.ok(
    source.includes("survey-connect-request.client"),
    "cyberdeck-app must import survey-connect-request.client",
  );
  assert.ok(
    source.includes("terminateEchoSurveySession"),
    "terminateEchoSurveySession remains allowed on cyberdeck-app",
  );
}

async function main(): Promise<void> {
  probeAutoConnectIntent();
  probeTripleLinkStatus();
  probeTripleLinkStore();
  probeHubUsesSharedTripleLinkProbe();
  probeSurveyPairingSplit();
  probePreviewMatrixSplit();
  probeHubResultFormatting();
  probeTeamIdStore();
  await probeConnectEventBridge();
  probeCyberdeckAppBoundary();
  console.log("probe-survey-hub-functional: all checks passed");
}

void main();
