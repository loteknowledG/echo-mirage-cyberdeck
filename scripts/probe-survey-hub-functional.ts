/**
 * Functional probes for Survey Hub — run before/after each refactor step:
 *   pnpm probe:survey-hub
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  EMPTY_SURVEY_TEAM_STATUS,
} from "../src/lib/cyberdeck/survey-team-status";
import {
  applySurveyTeamStatusSnapshot,
  getSurveyTeamStatusSnapshot,
  isSurveyTripleLinkedSync,
} from "../src/lib/cyberdeck/survey-team-status-store.client";
import { normalizePairedMirages } from "../src/lib/cyberdeck/survey-echo-status.client";
import { formatSurveyMissionSystemLine } from "../src/lib/cyberdeck/survey-muthur-mission.client";
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
  assert.equal(isSurveyTeamTripleLinked({ ...EMPTY_SURVEY_TEAM_STATUS, loading: true }), false);

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
  applySurveyTeamStatusSnapshot({ ...EMPTY_SURVEY_TEAM_STATUS, loading: true });
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

function probeStep4SpyRenameAndEmbed(): void {
  const paneBody = readFileSync(resolve("src/components/cyberdeck/survey-pane-body.tsx"), "utf8");
  assert.ok(paneBody.includes("cyberdeck-survey-pane"), "survey pane uses cyberdeck-survey-pane class");
  assert.ok(!paneBody.includes("cyberdeck-spy-pane"), "survey pane must not use cyberdeck-spy-pane");

  const subRail = readFileSync(resolve("src/components/cyberdeck/survey-sub-rail.tsx"), "utf8");
  assert.ok(!subRail.includes("spy-sub-rail"), "survey sub-rail must not use spy-sub-rail");

  const teamStatus = readFileSync(resolve("src/lib/cyberdeck/survey-team-status.ts"), "utf8");
  assert.ok(
    teamStatus.includes('echo-mirage-survey-team-status-changed'),
    "team status event uses survey name",
  );
  assert.ok(
    teamStatus.includes("LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT"),
    "legacy spy team event kept for migration",
  );
  assert.ok(teamStatus.includes("EMPTY_SURVEY_TEAM_STATUS"), "team status uses survey empty constant");

  const creds = readFileSync(resolve("src/lib/cyberdeck/survey-pair-credentials.client.ts"), "utf8");
  assert.ok(creds.includes("SurveyMiragePairCredentials"), "credentials use survey type names");
  assert.ok(creds.includes("readJsonStorageWithLegacyFallback"), "pair credentials migrate legacy storage keys");
  assert.ok(!creds.includes("SpyMiragePairCredentials"), "credentials must not export spy type aliases");

  const capture = readFileSync(resolve("src/lib/cyberdeck/powerfist-capture-client.ts"), "utf8");
  assert.ok(capture.includes("SURVEY_CAPTURE_HOST_STORAGE_KEY"), "capture storage uses survey keys");
  assert.ok(capture.includes("readStorageWithLegacyFallback"), "capture storage migrates legacy espionage keys");
}

function probeDeckMatrixEmbed(): void {
  const embed = readFileSync(resolve("src/components/cyberdeck/deck-matrix-embed.tsx"), "utf8");
  assert.ok(embed.includes("export function DeckMatrixEmbed"), "DeckMatrixEmbed exists");

  const triforce = readFileSync(resolve("src/components/cyberdeck/survey-triforce-deck-embed.tsx"), "utf8");
  assert.ok(triforce.includes("DeckMatrixEmbed"), "SurveyTriforceDeckEmbed uses DeckMatrixEmbed");
  assert.ok(!triforce.includes("PreviewMatrix"), "SurveyTriforceDeckEmbed must not import PreviewMatrix directly");

  const css = readFileSync(resolve("src/app/preview/preview-matrix.css"), "utf8");
  assert.ok(
    !css.includes(".cyberdeck-survey-powerfist-deck .powerfist-preview-root .deckSlide"),
    "survey deck CSS must not duplicate rola-dex deck chrome",
  );
}

function probePreviewMatrixSplit(): void {
  const matrix = readFileSync(resolve("src/app/preview/preview-matrix.tsx"), "utf8");
  assert.ok(matrix.includes("preview-matrix-play"), "preview-matrix must import play helpers");
  assert.ok(matrix.includes("use-powerfist-matrix-remote"), "preview-matrix must import remote hook");
  assert.ok(matrix.includes("use-preview-matrix-carousels"), "preview-matrix must import carousel hook");
  assert.ok(matrix.includes("use-preview-matrix-card-play"), "preview-matrix must import card play hook");
  assert.ok(matrix.includes("use-survey-deck-commands"), "preview-matrix must import deck command hook");
  assert.ok(
    !matrix.includes("function cardChatMessage"),
    "preview-matrix must not inline cardChatMessage",
  );
  assert.ok(
    !matrix.includes("connectPowerfistRemoteSocket"),
    "preview-matrix must not inline remote socket wiring",
  );
  assert.ok(!matrix.includes("EmblaCarousel("), "preview-matrix must not inline Embla setup");

  const matrixLines = matrix.split("\n").length;
  assert.ok(matrixLines < 320, "preview-matrix.tsx should be a thin view layer");

  const carousels = readFileSync(resolve("src/app/preview/use-preview-matrix-carousels.ts"), "utf8");
  assert.ok(carousels.includes("export function usePreviewMatrixCarousels"), "carousel hook must exist");

  const deckCommands = readFileSync(resolve("src/app/preview/use-survey-deck-commands.ts"), "utf8");
  assert.ok(deckCommands.includes("export function useSurveyDeckCommands"), "deck command hook must exist");

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

function probeSingleConnectOrchestrator(): void {
  const panelSource = readFileSync(resolve("src/components/cyberdeck/survey-hub-panel.tsx"), "utf8");
  assert.ok(
    !panelSource.includes("runSurveyHubConnect"),
    "SurveyHubPanel must not call runSurveyHubConnect directly",
  );
  assert.ok(
    panelSource.includes("requestSurveyHubConnectAndWait"),
    "SurveyHubPanel must request connect via event bridge",
  );
  assert.ok(
    !panelSource.includes("quiet: true"),
    "SurveyHubPanel must not run quiet auto-connect on mount",
  );

  const hostSource = readFileSync(resolve("src/components/cyberdeck/survey-auto-pair-host.tsx"), "utf8");
  assert.ok(
    hostSource.includes("runSurveyHubConnect"),
    "SurveyAutoPairHost must remain sole runSurveyHubConnect caller",
  );
}

function probeStep5CyberdeckExtraction(): void {
  const line = formatSurveyMissionSystemLine({
    missionId: "abcd-1234",
    kind: "silent-capture-solve",
    imageDataUrl: "data:image/png;base64,abc",
    prompt: "solve",
  });
  assert.match(line, /mission abcd-123/);
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
    !source.includes("requestSurveyHubConnectAndWait"),
    "cyberdeck-app must not call requestSurveyHubConnectAndWait directly",
  );
  assert.ok(
    !source.includes("survey-connect-request.client"),
    "cyberdeck-app must not import survey-connect-request.client",
  );
  assert.ok(
    !source.includes("terminateEchoSurveySession"),
    "cyberdeck-app must not call terminateEchoSurveySession directly",
  );
  assert.ok(
    !source.includes("survey-pairing-client"),
    "cyberdeck-app must not import survey-pairing-client",
  );
  assert.ok(
    source.includes("survey-muthur-connect.client"),
    "cyberdeck-app must use survey-muthur-connect.client",
  );
  assert.ok(
    source.includes("useSurveyMuthurArchive"),
    "cyberdeck-app must use useSurveyMuthurArchive hook",
  );
  assert.ok(
    source.includes("useSurveyMuthurMissionHandlers"),
    "cyberdeck-app must use useSurveyMuthurMissionHandlers hook",
  );
  assert.ok(
    source.includes("survey-tab-lifecycle.client"),
    "cyberdeck-app must use survey-tab-lifecycle.client",
  );
}

function probeSpyNamingAndShims(): void {
  const hook = readFileSync(resolve("src/lib/cyberdeck/use-survey-team-status.ts"), "utf8");
  assert.ok(
    hook.includes("LEGACY_SPY_TEAM_STATUS_CHANGED_EVENT"),
    "team status hook listens for legacy spy event",
  );

  const boundary = readFileSync(resolve("src/lib/cyberdeck/survey-boundary.ts"), "utf8");
  assert.ok(
    boundary.includes("return isSurveyHubEnabled()"),
    "isSurveyAutoPairEnabled delegates to Survey Hub",
  );

  const chat = readFileSync(resolve("src/lib/cyberdeck/survey-chat.ts"), "utf8");
  assert.ok(!chat.includes("notifySpyMuthurArchive"), "survey-chat must not export spy archive alias");

  const pairingBarrel = readFileSync(resolve("src/lib/cyberdeck/survey-pairing-client.ts"), "utf8");
  assert.ok(!pairingBarrel.includes("SpyMiragePairCredentials"), "pairing barrel must not re-export spy types");

  assert.ok(
    !existsSync(resolve("src/lib/cyberdeck/survey-auto-pair.client.ts")),
    "survey-auto-pair.client shim must be deleted",
  );
}

function probeHubOnlyUi(): void {
  const powerfist = readFileSync(resolve("src/components/cyberdeck/survey-powerfist-pane.tsx"), "utf8");
  assert.ok(powerfist.includes("isSurveyHubEnabled"), "PowerFist pane gates on Survey Hub");
  assert.ok(powerfist.includes("SurveyHubSubPaneHint"), "PowerFist pane uses hub retry hint");
  assert.ok(
    powerfist.includes("if (hubEnabled)"),
    "PowerFist pane must short-circuit when Survey Hub is on",
  );

  const mirage = readFileSync(resolve("src/components/cyberdeck/survey-mirage-pane.tsx"), "utf8");
  assert.ok(mirage.includes("!hubEnabled"), "Mirage pane hides hub QR panel when Survey Hub is on");
  assert.ok(mirage.includes("SurveyHubSubPaneHint"), "Mirage pane uses hub retry hint");

  const echo = readFileSync(resolve("src/components/cyberdeck/survey-echo-pane.tsx"), "utf8");
  assert.ok(echo.includes("!hubEnabled"), "Echo pane hides legacy PIN UI when Survey Hub is on");

  const hint = readFileSync(resolve("src/components/cyberdeck/survey-hub-subpane-hint.tsx"), "utf8");
  assert.ok(
    hint.includes("requestSurveyHubConnectAndWait"),
    "hub sub-pane hint must use event connect bridge",
  );
}

async function main(): Promise<void> {
  probeAutoConnectIntent();
  probeTripleLinkStatus();
  probeTripleLinkStore();
  probeHubUsesSharedTripleLinkProbe();
  probeSurveyPairingSplit();
  probePreviewMatrixSplit();
  probeStep4SpyRenameAndEmbed();
  probeDeckMatrixEmbed();
  probeSingleConnectOrchestrator();
  probeHubOnlyUi();
  probeSpyNamingAndShims();
  probeStep5CyberdeckExtraction();
  probeHubResultFormatting();
  probeTeamIdStore();
  await probeConnectEventBridge();
  probeCyberdeckAppBoundary();
  console.log("probe-survey-hub-functional: all checks passed");
}

void main();
