"use client";

import { getOrCreateSurveyNodeId } from "@/lib/cyberdeck/survey-mode";
import { notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";
import {
  fetchEchoRemoteSurveyCodesClient,
  fetchEchoSurveyLinkStatus,
  fetchEchoSurveyStatus,
  normalizePairedMirages,
  readSurveyMiragePairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { SURVEY_PAIRING_TRACE_EVENT } from "@/lib/cyberdeck/survey-pairing-trace";

const DEBUG_PREFIX = "[SURVEY DBG]";

let traceListenerInstalled = false;

function shellLabel(): string {
  if (typeof window === "undefined") return "server";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return `local cyberdeck (${host})`;
  if (window.matchMedia("(display-mode: standalone)").matches) return `PWA (${host})`;
  return `browser (${host})`;
}

export function notifySurveyPairingDebug(text: string): void {
  const line = text.trim();
  if (!line) return;
  notifySurveyMuthurArchive(`${DEBUG_PREFIX} ${line}`);
}

export function initSurveyPairingDebug(): void {
  if (typeof window === "undefined" || traceListenerInstalled) return;
  traceListenerInstalled = true;

  window.addEventListener(SURVEY_PAIRING_TRACE_EVENT, (event) => {
    const text = (event as CustomEvent<{ text?: string }>).detail?.text?.trim();
    if (text) notifySurveyPairingDebug(text);
  });
}

export async function emitSurveyPairingDiagnostics(trigger: string): Promise<void> {
  notifySurveyPairingDebug(`── diagnostics: ${trigger} ──`);
  notifySurveyPairingDebug(`shell: ${shellLabel()}`);
  notifySurveyPairingDebug(`mirage nodeId: ${getOrCreateSurveyNodeId().slice(0, 8)}…`);

  const creds = readSurveyMiragePairCredentials();
  if (creds) {
    notifySurveyPairingDebug(
      `saved creds: yes · echo ${creds.echoHost}:${creds.httpPort} · epoch ${creds.sessionEpoch} · node ${creds.nodeId.slice(0, 8)}…`,
    );
  } else {
    notifySurveyPairingDebug("saved creds: none (not paired on this device yet)");
  }

  const echoLocal = await fetchEchoSurveyStatus();
  if (echoLocal.ok) {
    const mirages = normalizePairedMirages(echoLocal);
    notifySurveyPairingDebug(
      `echo local API: ok (${echoLocal.source}) · host ${echoLocal.echoHost}:${echoLocal.httpPort} · paired mirages ${mirages.length}`,
    );
  } else {
    notifySurveyPairingDebug(`echo local API: fail — ${echoLocal.reason}`);
  }

  const probeHost = creds?.echoHost ?? null;
  const probePort = creds?.httpPort ?? 3050;
  const probeNodeId = creds?.echoNodeId ?? null;

  if (probeNodeId) {
    try {
      const relay = await fetch(
        `/api/survey/relay/bundle?echoNodeId=${encodeURIComponent(probeNodeId)}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      const payload = (await relay.json()) as { ok?: boolean; storage?: string; reason?: string };
      notifySurveyPairingDebug(
        relay.ok && payload.ok
          ? `cloud relay bundle: ok · storage ${payload.storage ?? "?"}`
          : `cloud relay bundle: ${payload.reason ?? `HTTP ${relay.status}`}`,
      );
    } catch {
      notifySurveyPairingDebug("cloud relay bundle: fetch failed");
    }
  }

  if (probeHost) {
    const remote = await fetchEchoRemoteSurveyCodesClient(probeHost, probePort);
    if (remote.ok) {
      const mirages = normalizePairedMirages(remote);
      notifySurveyPairingDebug(
        [
          `echo remote ${probeHost}:${probePort}: ok`,
          `surveyActive=${remote.echoSurveyActive !== false ? "yes" : "no"}`,
          `epoch=${remote.sessionEpoch ?? "?"}`,
          `miragePin=${remote.miragePin ? "shown" : "hidden"}`,
          `pairedMirages=${mirages.length}`,
          creds ? `nodeMatch=${mirages.some((m) => m.nodeId === creds.nodeId) ? "yes" : "no"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } else {
      notifySurveyPairingDebug(`echo remote ${probeHost}:${probePort}: fail — ${remote.reason}`);
    }
  } else {
    notifySurveyPairingDebug(
      "echo remote: skipped — enter Echo Satellite IP and port above (e.g. 100.66.91.18:3050).",
    );
  }

  if (creds) {
    const link = await fetchEchoSurveyLinkStatus({
      echoNodeId: creds.echoNodeId,
      role: "mirage",
      sessionEpoch: creds.sessionEpoch,
      nodeId: creds.nodeId,
      echoHost: creds.echoHost,
      httpPort: creds.httpPort,
    });
    if (!link.ok) {
      notifySurveyPairingDebug(`link poll: unreachable — ${link.reason}`);
    } else if (link.active) {
      notifySurveyPairingDebug(`link poll: active (epoch ${link.sessionEpoch})`);
    } else {
      notifySurveyPairingDebug(`link poll: inactive — ${link.message}`);
    }
  } else {
    notifySurveyPairingDebug("link poll: skipped — pair first, then click Pair with ECHO");
  }

  notifySurveyPairingDebug(
    "hint: Mirage enters the 6-digit code FROM Echo Satellite Survey tab — not the code Mirage shows.",
  );
}
