"use client";

import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
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
  readPowerfistRemoteCredentials,
} from "@/lib/cyberdeck/powerfist-remote-socket";
import {
  enterSurveyPairPin,
  fetchEchoRemoteSurveyStatusClient,
  fetchEchoSurveyLinkStatus,
  fetchEchoSurveyStatus,
  isSurveyHttpsPairBlocked,
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  saveSurveyMiragePairCredentials,
  saveSurveyPowerfistPairCredentials,
  type EchoSurveyStatus,
} from "@/lib/cyberdeck/survey-pairing-client";
import { enterSurveyPairPinViaRelay, fetchSurveyRelayBundle } from "@/lib/cyberdeck/survey-relay.client";
import { resolveSurveyHubTeamId, saveSurveyHubTeamId } from "@/lib/cyberdeck/survey-hub-store.client";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";

export const SURVEY_HUB_CONNECT_REQUEST_EVENT = "echo-mirage:survey-hub-connect-request";
/** @deprecated use SURVEY_HUB_CONNECT_REQUEST_EVENT */
export const SURVEY_AUTO_PAIR_REQUEST_EVENT = SURVEY_HUB_CONNECT_REQUEST_EVENT;

const HUB_CONNECT_SESSION_KEY = "echo-mirage-survey-hub-connect-at";
const HUB_CONNECT_COOLDOWN_MS = 45_000;

export type SurveyHubConnectStep = {
  id: "mirage" | "powerfist-echo" | "powerfist-hub";
  ok: boolean;
  detail: string;
};

export type SurveyHubConnectResult = {
  ran: boolean;
  skipped?: string;
  steps: SurveyHubConnectStep[];
  echoNodeId?: string | null;
};

export type SurveyAutoPairStep = SurveyHubConnectStep;
export type SurveyAutoPairResult = SurveyHubConnectResult;

function log(line: string): void {
  notifySurveyMuthurArchive(`SURVEY HUB // ${line}`);
}

function shouldThrottleHubConnect(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const last = Number(window.sessionStorage.getItem(HUB_CONNECT_SESSION_KEY));
    if (Number.isFinite(last) && Date.now() - last < HUB_CONNECT_COOLDOWN_MS) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function markHubConnectRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HUB_CONNECT_SESSION_KEY, String(Date.now()));
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
  const savedRemote = readPowerfistRemoteCredentials();
  const hubSession = await fetchPowerfistQrSession();
  if (hubSession.ok && hubSession.pairedRemote) {
    if (savedRemote && savedRemote.deviceId !== hubSession.pairedRemote.deviceId) {
      return false;
    }
    return true;
  }
  return false;
}

async function restoreMirageHubLink(): Promise<{ ok: boolean; detail: string }> {
  const savedRemote = readPowerfistRemoteCredentials();
  const hubSession = await fetchPowerfistQrSession();
  if (hubSession.ok && hubSession.pairedRemote) {
    return { ok: true, detail: "already linked" };
  }

  let hubPin: string | null = hubSession.ok ? hubSession.remotePin : null;
  if (!hubPin) {
    const created = await createPowerfistQrSession();
    if (!created.ok) {
      return { ok: false, detail: created.reason };
    }
    hubPin = created.remotePin;
  }

  if (!hubPin) {
    return { ok: false, detail: "Mirage hub offline — reload cyberdeck and retry." };
  }

  const paired = await completePowerfistPairFromPin(hubPin);
  if (paired.ok) {
    const label = savedRemote
      ? `re-linked device ${paired.deviceId.slice(0, 8)}…`
      : `hub code ${hubPin}`;
    return { ok: true, detail: label };
  }
  return { ok: false, detail: paired.reason };
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

type PairSuccess = {
  ok: true;
  echoHost: string;
  httpPort: number;
  echoNodeId: string;
  token: string;
  nodeId?: string;
  deviceId?: string;
  sessionEpoch: number;
};

async function pairMirageDirect(echo: EchoSurveyStatus): Promise<PairSuccess | { ok: false; detail: string }> {
  if (!echo.miragePin) {
    return { ok: false, detail: "No Mirage code on Echo — open Echo Satellite Survey tab." };
  }
  const result = await enterSurveyPairPin({
    echoHost: echo.echoHost,
    echoHttpPort: echo.httpPort,
    pin: echo.miragePin,
    role: "mirage",
    hintHosts: [echo.echoHost],
  });
  if (!result.ok) return { ok: false, detail: result.reason };
  saveSurveyMiragePairCredentials({
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    mirageToken: result.token,
    nodeId: result.nodeId ?? "",
    sessionEpoch: result.sessionEpoch,
    pairedAt: new Date().toISOString(),
  });
  saveSurveyHubTeamId(result.echoNodeId);
  return result;
}

async function pairPowerfistEchoDirect(echo: EchoSurveyStatus): Promise<PairSuccess | { ok: false; detail: string }> {
  if (!echo.powerfistPin) {
    return { ok: false, detail: "No PowerFist code on Echo — regenerate codes on Echo Satellite." };
  }
  const result = await enterSurveyPairPin({
    echoHost: echo.echoHost,
    echoHttpPort: echo.httpPort,
    pin: echo.powerfistPin,
    role: "powerfist",
    hintHosts: [echo.echoHost],
  });
  if (!result.ok) return { ok: false, detail: result.reason };
  saveSurveyPowerfistPairCredentials({
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    remoteToken: result.token,
    deviceId: result.deviceId ?? "",
    sessionEpoch: result.sessionEpoch,
    pairedAt: new Date().toISOString(),
  });
  saveSurveyHubTeamId(result.echoNodeId);
  return result;
}

async function pairMirageRelay(
  echoNodeId: string,
  miragePin: string,
): Promise<PairSuccess | { ok: false; detail: string }> {
  const result = await enterSurveyPairPinViaRelay({
    echoNodeId,
    pin: miragePin,
    role: "mirage",
  });
  if (!result.ok) return { ok: false, detail: result.reason };
  saveSurveyMiragePairCredentials({
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    mirageToken: result.token,
    nodeId: result.nodeId ?? "",
    sessionEpoch: result.sessionEpoch,
    pairedAt: new Date().toISOString(),
  });
  saveSurveyHubTeamId(result.echoNodeId);
  return {
    ok: true,
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    token: result.token,
    nodeId: result.nodeId,
    sessionEpoch: result.sessionEpoch,
  };
}

async function pairPowerfistEchoRelay(
  echoNodeId: string,
  powerfistPin: string,
): Promise<PairSuccess | { ok: false; detail: string }> {
  const result = await enterSurveyPairPinViaRelay({
    echoNodeId,
    pin: powerfistPin,
    role: "powerfist",
  });
  if (!result.ok) return { ok: false, detail: result.reason };
  saveSurveyPowerfistPairCredentials({
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    remoteToken: result.token,
    deviceId: result.deviceId ?? "",
    sessionEpoch: result.sessionEpoch,
    pairedAt: new Date().toISOString(),
  });
  saveSurveyHubTeamId(result.echoNodeId);
  return {
    ok: true,
    echoHost: result.echoHost,
    httpPort: result.httpPort,
    echoNodeId: result.echoNodeId,
    token: result.token,
    deviceId: result.deviceId,
    sessionEpoch: result.sessionEpoch,
  };
}

/**
 * Survey Hub — one-shot connect for Echo ↔ Mirage ↔ PowerFist.
 * Desktop: reads Echo pins locally. HTTPS / cross-network: cloud relay (no manual PIN entry).
 */
export async function runSurveyHubConnect(options?: {
  echoNodeId?: string;
  force?: boolean;
  quiet?: boolean;
}): Promise<SurveyHubConnectResult> {
  const steps: SurveyHubConnectStep[] = [];
  const quiet = options?.quiet === true;

  if (!isSurveyHubEnabled()) {
    return { ran: false, skipped: "Survey Hub disabled.", steps };
  }
  if (!options?.force && shouldThrottleHubConnect()) {
    return { ran: false, skipped: "Survey Hub connect ran recently.", steps };
  }

  if (await isSurveyTripleLinked()) {
    const teamId =
      resolveSurveyHubTeamId(options?.echoNodeId) ??
      readSurveyMiragePairCredentials()?.echoNodeId ??
      null;
    return {
      ran: true,
      echoNodeId: teamId,
      steps: [
        { id: "mirage", ok: true, detail: "already linked" },
        { id: "powerfist-echo", ok: true, detail: "already linked" },
        { id: "powerfist-hub", ok: true, detail: "already linked" },
      ],
    };
  }

  if (!quiet) {
    log("connecting team…");
  }
  markHubConnectRun();

  const useRelay = isSurveyHttpsPairBlocked();
  let echoNodeId = resolveSurveyHubTeamId(options?.echoNodeId);

  if (!useRelay) {
    const echo = await resolveEchoStatus();
    if (echo.ok) {
      if (echo.echoNodeId) {
        echoNodeId = echo.echoNodeId;
        saveSurveyHubTeamId(echo.echoNodeId);
      }

      if (!(await mirageEchoLinkActive())) {
        const paired = await pairMirageDirect(echo);
        if (paired.ok) {
          log(formatSurveyEchoMirageLinkedLine(paired.echoHost));
          steps.push({ id: "mirage", ok: true, detail: `${paired.echoHost}:${paired.httpPort}` });
        } else {
          log(`Mirage pair failed — ${paired.detail}`);
          steps.push({ id: "mirage", ok: false, detail: paired.detail });
        }
      } else {
        steps.push({ id: "mirage", ok: true, detail: "already linked" });
      }

      if (!(await powerfistEchoLinkActive())) {
        const paired = await pairPowerfistEchoDirect(echo);
        if (paired.ok) {
          log(formatSurveyEchoPowerfistLinkedLine(paired.echoHost));
          steps.push({ id: "powerfist-echo", ok: true, detail: `${paired.echoHost}:${paired.httpPort}` });
        } else {
          log(`PowerFist ↔ Echo failed — ${paired.detail}`);
          steps.push({ id: "powerfist-echo", ok: false, detail: paired.detail });
        }
      } else {
        steps.push({ id: "powerfist-echo", ok: true, detail: "already linked" });
      }
    } else if (!echoNodeId) {
      if (!quiet) log(`skipped — ${echo.reason}`);
      return { ran: false, skipped: echo.reason, steps, echoNodeId: null };
    }
  }

  if (useRelay || steps.length === 0) {
    if (!echoNodeId) {
      echoNodeId =
        readSurveyMiragePairCredentials()?.echoNodeId ??
        readSurveyPowerfistPairCredentials()?.echoNodeId ??
        null;
    }
    if (!echoNodeId) {
      const msg =
        "Enter Echo team ID once (from Echo Satellite status panel) — Survey Hub saves it for next time.";
      if (!quiet) log(msg);
      return { ran: false, skipped: msg, steps, echoNodeId: null };
    }

    saveSurveyHubTeamId(echoNodeId);

    const bundleResult = await fetchSurveyRelayBundle(echoNodeId);
    if (!bundleResult.ok) {
      if (!quiet) log(`relay — ${bundleResult.reason}`);
      return { ran: false, skipped: bundleResult.reason, steps, echoNodeId };
    }

    const bundle = bundleResult.bundle;
    if (!quiet) {
      log(`relay bundle · team ${echoNodeId.slice(0, 8)}… · Echo ${bundle.echoHost}`);
    }

    if (!(await mirageEchoLinkActive())) {
      const paired = await pairMirageRelay(echoNodeId, bundle.miragePin);
      if (paired.ok) {
        log(formatSurveyEchoMirageLinkedLine(paired.echoHost));
        steps.push({ id: "mirage", ok: true, detail: `relay · ${paired.echoHost}` });
      } else {
        log(`Mirage relay failed — ${paired.detail}`);
        steps.push({ id: "mirage", ok: false, detail: paired.detail });
      }
    } else {
      steps.push({ id: "mirage", ok: true, detail: "already linked" });
    }

    if (!(await powerfistEchoLinkActive())) {
      const pfPin = bundle.powerfistPin;
      if (!pfPin) {
        steps.push({
          id: "powerfist-echo",
          ok: false,
          detail: "Echo has no PowerFist code yet — open Echo Satellite Survey tab.",
        });
      } else {
        const paired = await pairPowerfistEchoRelay(echoNodeId, pfPin);
        if (paired.ok) {
          log(formatSurveyEchoPowerfistLinkedLine(paired.echoHost));
          steps.push({ id: "powerfist-echo", ok: true, detail: `relay · ${paired.echoHost}` });
        } else {
          log(`PowerFist relay failed — ${paired.detail}`);
          steps.push({ id: "powerfist-echo", ok: false, detail: paired.detail });
        }
      }
    } else {
      steps.push({ id: "powerfist-echo", ok: true, detail: "already linked" });
    }
  }

  const hubSession = await fetchPowerfistQrSession();
  const hubLinked = await mirageHubLinkActive();
  if (!hubLinked) {
    const restored = await restoreMirageHubLink();
    if (restored.ok) {
      log(formatSurveyMiragePowerfistLinkedLine(readPowerfistRemoteCredentials()?.deviceId ?? "remote"));
      steps.push({ id: "powerfist-hub", ok: true, detail: restored.detail });
    } else {
      log(`Mirage hub failed — ${restored.detail}`);
      steps.push({ id: "powerfist-hub", ok: false, detail: restored.detail });
    }
  } else {
    steps.push({
      id: "powerfist-hub",
      ok: true,
      detail:
        hubSession.ok && hubSession.pairedRemote
          ? `device ${hubSession.pairedRemote.deviceId.slice(0, 8)}…`
          : "already linked",
    });
  }

  notifySurveyTeamStatusChanged();

  const failed = steps.filter((step) => !step.ok).length;
  if (failed === 0) {
    log("team connected — all links green.");
  } else {
    log(`${failed} link(s) need attention — ensure Echo Satellite Survey tab is open, then retry.`);
  }

  return {
    ran: true,
    steps,
    echoNodeId: echoNodeId ?? resolveSurveyHubTeamId(),
  };
}

/** @deprecated use runSurveyHubConnect */
export async function runSurveyAutoPair(options?: {
  force?: boolean;
  quiet?: boolean;
}): Promise<SurveyAutoPairResult> {
  return runSurveyHubConnect(options);
}

export function formatSurveyHubResultForMuthur(result: SurveyHubConnectResult): string {
  if (!result.ran) {
    return `SURVEY HUB // SKIPPED // ${result.skipped ?? "not run"}`;
  }

  const lines = result.steps.map(
    (step) => `${step.id.toUpperCase()} // ${step.ok ? "OK" : "FAIL"} // ${step.detail}`,
  );
  const failed = result.steps.filter((step) => !step.ok).length;
  const header =
    failed === 0
      ? "SURVEY HUB // CONNECTED // all TEAM LINKS green"
      : `SURVEY HUB // PARTIAL // ${failed} link(s) need attention`;

  const teamLine = result.echoNodeId ? `TEAM ID // ${result.echoNodeId}` : null;
  return [header, teamLine, ...lines].filter(Boolean).join("\n");
}

/** @deprecated use formatSurveyHubResultForMuthur */
export function formatSurveyAutoPairResultForMuthur(result: SurveyAutoPairResult): string {
  return formatSurveyHubResultForMuthur(result);
}
