/**
 * Static boundary checks for Survey connect refactor steps.
 *   pnpm probe:survey-connect-boundary
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function assertNoImport(source: string, moduleId: string, fileLabel: string): void {
  assert.ok(
    !source.includes(moduleId),
    `${fileLabel} must not reference ${moduleId}`,
  );
}

function assertHasImport(source: string, moduleId: string, fileLabel: string): void {
  assert.ok(source.includes(moduleId), `${fileLabel} must reference ${moduleId}`);
}

function main(): void {
  const cyberdeckApp = read("src/features/cyberdeck/cyberdeck-app.tsx");
  assertNoImport(cyberdeckApp, "survey-hub.client", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "survey-auto-pair.client", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "survey-relay.client", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "runSurveyAutoPair", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "runSurveyHubConnect", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "survey-pairing-client", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "survey-connect-request.client", "cyberdeck-app");
  assertNoImport(cyberdeckApp, "requestSurveyHubConnectAndWait", "cyberdeck-app");
  assertHasImport(cyberdeckApp, "survey-muthur-connect.client", "cyberdeck-app");
  assertHasImport(cyberdeckApp, "survey-tab-lifecycle.client", "cyberdeck-app");
  assertHasImport(cyberdeckApp, "useSurveyMuthurArchive", "cyberdeck-app");
  assertHasImport(cyberdeckApp, "useSurveyMuthurMissionHandlers", "cyberdeck-app");

  const connectRequest = read("src/lib/cyberdeck/survey-connect-request.client.ts");
  assertNoImport(connectRequest, "survey-pairing-client", "survey-connect-request");
  assertNoImport(connectRequest, "survey-relay.client", "survey-connect-request");
  assertNoImport(connectRequest, "survey-hub.client", "survey-connect-request");

  const connectEvents = read("src/lib/cyberdeck/survey-hub-connect-events.ts");
  assertNoImport(connectEvents, "survey-pairing", "survey-hub-connect-events");
  assertNoImport(connectEvents, "powerfist-remote", "survey-hub-connect-events");

  const pairingBarrel = read("src/lib/cyberdeck/survey-pairing-client.ts");
  assert.ok(pairingBarrel.split("\n").length < 60, "survey-pairing-client must be a thin barrel");
  assertHasImport(pairingBarrel, "survey-echo-status.client", "survey-pairing-client");

  const autoPairHost = read("src/components/cyberdeck/survey-auto-pair-host.tsx");
  assertHasImport(autoPairHost, "useSurveyTeamStatus", "SurveyAutoPairHost");
  assertHasImport(autoPairHost, "isSurveyTeamTripleLinked", "SurveyAutoPairHost");
  assertNoImport(autoPairHost, "isSurveyTripleLinked", "SurveyAutoPairHost");
  assertHasImport(autoPairHost, "runSurveyHubConnect", "SurveyAutoPairHost");

  const hubPanel = read("src/components/cyberdeck/survey-hub-panel.tsx");
  assertNoImport(hubPanel, "runSurveyHubConnect", "SurveyHubPanel");
  assertNoImport(hubPanel, "survey-hub.client", "SurveyHubPanel");
  assertHasImport(hubPanel, "requestSurveyHubConnectAndWait", "SurveyHubPanel");

  console.log("probe-survey-connect-boundary: all checks passed");
}

main();
