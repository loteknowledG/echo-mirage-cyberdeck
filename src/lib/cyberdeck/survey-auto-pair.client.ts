"use client";

import {
  isSurveyAutoPairEnabled,
  isSurveyLegacyPairingEnabled,
} from "@/lib/cyberdeck/survey-boundary";
import {
  formatSurveyEchoMirageLinkedLine,
  formatSurveyEchoPowerfistLinkedLine,
  formatSurveyMiragePowerfistLinkedLine,
  notifySurveyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import {
  completePowerfistPairFromPin,
  createPowerfistQrSession,
  fetchPowerfistQrSession,
} from "@/lib/cyberdeck/powerfist-remote-socket";
import { isSurveyHttpsPairBlocked } from "@/lib/cyberdeck/survey-pairing-client";
import {
  enterSurveyPairPin,
  fetchEchoRemoteSurveyStatusClient,
  fetchEchoSurveyLinkStatus,
  fetchEchoSurveyStatus,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  saveSurveyMiragePairCredentials,
  saveSurveyPowerfistPairCredentials,
  type EchoSurveyStatus,
} from "@/lib/cyberdeck/survey-pairing-client";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";

export const SURVEY_AUTO_PAIR_REQUEST_EVENT = "echo-mirage:survey-auto-pair-request";

const AUTO_PAIR_SESSION_KEY = "echo-mirage-survey-auto-pair-at";
const AUTO_PAIR_COOLDOWN_MS = 90_000;

export type SurveyAutoPairStep = {
  id: "mirage" | "powerfist-echo" | "powerfist-hub";
  ok: boolean;
  detail: string;
};

export type SurveyAutoPairResult = {
  ran: boolean;
  skipped?: string;
  steps: SurveyAutoPairStep[];
};

function log(line: string): void {
  notifySurveyMuthurArchive(`SURVEY // auto-pair · ${line}`);
}

function shouldThrottleAutoPair(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const last = Number(window.sessionStorage.getItem(AUTO_PAIR_SESSION_KEY));
    if (Number.isFinite(last) && Date.now() - last < AUTO_PAIR_COOLDOWN_MS) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function markAutoPairRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTO_PAIR_SESSION_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function resolveEchoStatus(): Promise<EchoSurveyStatus | { ok: false; reason: string }> {
  const local = await fetchEchoSurveyStatus();
  if (local.ok) return local;

  const mirageCreds = readSurveyMiragePairCredentials();
  const powerfistCreds = readSurveyPowerfistPairCredentials();
  const host = mirageCreds?.echoHost ?? powerfistCreds?.echoHost;
  const port = mirageCreds?.httpPort ?? powerfistCreds?.httpPort ?? 3050;
  if (host) {
    return fetchEchoRemoteSurveyStatusClient(host, port);
  }

  return local;
}

async function mirageEchoLinkActive(): Promise<boolean> {
  const creds = readSurveyMiragePairCredentials();
  if (!creds) return false;
  const status = await fetchEchoSurveyLinkStatus({
    echoNodeId: creds.echoNodeId,
    role: "mirage",
    sessionEpoch: creds.sessionEpoch,
    nodeId: creds.nodeId,
    echoHost: creds.echoHost,
    httpPort: creds.httpPort,
  });
  return status.ok && status.active === true;
}

async function powerfistEchoLinkActive(): Promise<boolean> {
  const creds = readSurveyPowerfistPairCredentials();
  if (!creds) return false;
  const status = await fetchEchoSurveyLinkStatus({
    echoNodeId: creds.echoNodeId,
    role: "powerfist",
    sessionEpoch: creds.sessionEpoch,
    deviceId: creds.deviceId,
    echoHost: creds.echoHost,
    httpPort: creds.httpPort,
  });
  return status.ok && status.active === true;
}

async function mirageHubLinkActive(): Promise<boolean> {
  const hubSession = await fetchPowerfistQrSession();
  return hubSession.ok && Boolean(hubSession.pairedRemote);
}

/** True when Echo↔Mirage, Echo↔PowerFist, and Mirage↔PowerFist hub are all active. */
export async function isSurveyTripleLinked(): Promise<boolean> {
  const [mirage, powerfistEcho, hub] = await Promise.all([
    mirageEchoLinkActive(),
    powerfistEchoLinkActive(),
    mirageHubLinkActive(),
  ]);
  return mirage && powerfistEcho && hub;
}

/** Desktop / localhost: read Echo pins and wire Mirage + PowerFist without manual entry. */
export async function runSurveyAutoPair(options?: {
  force?: boolean;
  quiet?: boolean;
}): Promise<SurveyAutoPairResult> {
  const steps: SurveyAutoPairStep[] = [];
  const quiet = options?.quiet === true;

  if (!isSurveyLegacyPairingEnabled()) {
    return { ran: false, skipped: "Legacy pairing disabled.", steps };
  }
  if (!isSurveyAutoPairEnabled()) {
    return { ran: false, skipped: "Auto-pair disabled.", steps };
  }
  if (isSurveyHttpsPairBlocked()) {
    return { ran: false, skipped: "HTTPS shell — use desktop cyberdeck or cloud relay.", steps };
  }
  if (!options?.force && shouldThrottleAutoPair()) {
    return { ran: false, skipped: "Auto-pair ran recently.", steps };
  }

  if (await isSurveyTripleLinked()) {
    return {
      ran: true,
      steps: [
        { id: "mirage", ok: true, detail: "already linked" },
        { id: "powerfist-echo", ok: true, detail: "already linked" },
        { id: "powerfist-hub", ok: true, detail: "already linked" },
      ],
    };
  }

  if (!quiet) {
    log("starting — reading Echo Satellite…");
  }
  const echo = await resolveEchoStatus();
  if (!echo.ok) {
    if (!quiet) {
      log(`skipped — ${echo.reason}`);
    }
    return { ran: false, skipped: echo.reason, steps };
  }

  const echoHost = echo.echoHost;
  const echoPort = echo.httpPort;
  markAutoPairRun();

  if (!(await mirageEchoLinkActive()) && echo.miragePin) {
    const result = await enterSurveyPairPin({
      echoHost,
      echoHttpPort: echoPort,
      pin: echo.miragePin,
      role: "mirage",
      hintHosts: [echoHost],
    });
    if (result.ok) {
      saveSurveyMiragePairCredentials({
        echoHost: result.echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        mirageToken: result.token,
        nodeId: result.nodeId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      });
      log(formatSurveyEchoMirageLinkedLine(result.echoHost));
      steps.push({ id: "mirage", ok: true, detail: `${result.echoHost}:${result.httpPort}` });
    } else {
      log(`Mirage pair failed — ${result.reason}`);
      steps.push({ id: "mirage", ok: false, detail: result.reason });
    }
  } else if (await mirageEchoLinkActive()) {
    steps.push({ id: "mirage", ok: true, detail: "already linked" });
  } else {
    steps.push({
      id: "mirage",
      ok: false,
      detail: "No Mirage code on Echo — open Echo Satellite Survey tab or regenerate codes.",
    });
  }

  if (!(await powerfistEchoLinkActive()) && echo.powerfistPin) {
    const result = await enterSurveyPairPin({
      echoHost,
      echoHttpPort: echoPort,
      pin: echo.powerfistPin,
      role: "powerfist",
      hintHosts: [echoHost],
    });
    if (result.ok) {
      saveSurveyPowerfistPairCredentials({
        echoHost: result.echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        remoteToken: result.token,
        deviceId: result.deviceId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      });
      log(formatSurveyEchoPowerfistLinkedLine(result.echoHost));
      steps.push({ id: "powerfist-echo", ok: true, detail: `${result.echoHost}:${result.httpPort}` });
    } else {
      log(`PowerFist ↔ Echo failed — ${result.reason}`);
      steps.push({ id: "powerfist-echo", ok: false, detail: result.reason });
    }
  } else if (await powerfistEchoLinkActive()) {
    steps.push({ id: "powerfist-echo", ok: true, detail: "already linked" });
  } else {
    steps.push({
      id: "powerfist-echo",
      ok: false,
      detail: "No PowerFist code on Echo — regenerate codes on Echo Satellite.",
    });
  }

  const hubSession = await fetchPowerfistQrSession();
  const hubLinked = hubSession.ok && Boolean(hubSession.pairedRemote);
  if (!hubLinked) {
    let hubPin: string | null = null;
    if (hubSession.ok && hubSession.remotePin) {
      hubPin = hubSession.remotePin;
    } else {
      const created = await createPowerfistQrSession();
      if (created.ok) {
        hubPin = created.remotePin;
      } else {
        log(`Mirage hub offline — ${created.reason}`);
        steps.push({ id: "powerfist-hub", ok: false, detail: created.reason });
      }
    }

    if (hubPin) {
      const paired = await completePowerfistPairFromPin(hubPin);
      if (paired.ok) {
        log(formatSurveyMiragePowerfistLinkedLine(paired.deviceId));
        steps.push({ id: "powerfist-hub", ok: true, detail: `hub code ${hubPin}` });
      } else {
        log(`Mirage hub pair failed — ${paired.reason}`);
        steps.push({ id: "powerfist-hub", ok: false, detail: paired.reason });
      }
    }
  } else {
    steps.push({ id: "powerfist-hub", ok: true, detail: "already linked" });
  }

  notifySurveyTeamStatusChanged();

  const failed = steps.filter((step) => !step.ok).length;
  if (failed === 0) {
    log("complete — all TEAM LINKS should be green. Refresh if needed.");
  } else {
    log(`done with ${failed} step(s) needing attention — see Survey tab or regenerate Echo codes.`);
  }

  return { ran: true, steps };
}

export function formatSurveyAutoPairResultForMuthur(result: SurveyAutoPairResult): string {
  if (!result.ran) {
    return `SURVEY AUTO-CONNECT // SKIPPED // ${result.skipped ?? "not run"}`;
  }

  const lines = result.steps.map(
    (step) => `${step.id.toUpperCase()} // ${step.ok ? "OK" : "FAIL"} // ${step.detail}`,
  );
  const failed = result.steps.filter((step) => !step.ok).length;
  const header =
    failed === 0
      ? "SURVEY AUTO-CONNECT // COMPLETE // all TEAM LINKS wired"
      : `SURVEY AUTO-CONNECT // PARTIAL // ${failed} step(s) need attention`;

  return [header, ...lines].join("\n");
}
