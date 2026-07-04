"use client";

import type { SurveyHubConnectResult } from "@/lib/cyberdeck/survey-hub-connect-events";

export const SURVEY_HUB_DIAGNOSTICS_CHANGED_EVENT = "echo-mirage:survey-hub-diagnostics-changed";

export type SurveyHubRestoreDiagnostic = {
  ok: boolean;
  detail: string;
  at: string;
  source: "hub-restore" | "muthur" | "auto-restore";
};

export type SurveyHubRelayDiagnostic = {
  relayRunning: boolean;
  paired: boolean;
  deviceId?: string;
  qrActive?: boolean;
  at: string;
  reason?: string;
};

export type SurveyHubDiagnosticsSnapshot = {
  lastConnect: (SurveyHubConnectResult & { at: string }) | null;
  lastHubRestore: SurveyHubRestoreDiagnostic | null;
  relay: SurveyHubRelayDiagnostic | null;
};

let snapshot: SurveyHubDiagnosticsSnapshot = {
  lastConnect: null,
  lastHubRestore: null,
  relay: null,
};

export function getSurveyHubDiagnosticsSnapshot(): SurveyHubDiagnosticsSnapshot {
  return snapshot;
}

function notifyDiagnosticsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_HUB_DIAGNOSTICS_CHANGED_EVENT));
}

export function recordSurveyHubConnectDiagnostic(result: SurveyHubConnectResult): void {
  snapshot = {
    ...snapshot,
    lastConnect: { ...result, at: new Date().toISOString() },
  };
  notifyDiagnosticsChanged();
}

export function recordSurveyHubRestoreDiagnostic(
  input: Pick<SurveyHubRestoreDiagnostic, "ok" | "detail" | "source">,
): void {
  snapshot = {
    ...snapshot,
    lastHubRestore: {
      ...input,
      at: new Date().toISOString(),
    },
  };
  notifyDiagnosticsChanged();
}

export function recordSurveyHubRelayDiagnostic(relay: Omit<SurveyHubRelayDiagnostic, "at">): void {
  snapshot = {
    ...snapshot,
    relay: {
      ...relay,
      at: new Date().toISOString(),
    },
  };
  notifyDiagnosticsChanged();
}

/** Live Mirage hub relay status for TEAM LINKS diagnostics. */
export async function probeSurveyHubRelayDiagnostic(): Promise<SurveyHubRelayDiagnostic> {
  try {
    const res = await fetch("/api/powerfist/pairing/status", { cache: "no-store" });
    if (!res.ok) {
      const relay: SurveyHubRelayDiagnostic = {
        relayRunning: false,
        paired: false,
        at: new Date().toISOString(),
        reason: `HTTP ${res.status}`,
      };
      recordSurveyHubRelayDiagnostic(relay);
      return relay;
    }
    const payload = (await res.json()) as {
      relayRunning?: boolean;
      paired?: boolean;
      deviceId?: string;
      qrActive?: boolean;
    };
    const relay: SurveyHubRelayDiagnostic = {
      relayRunning: payload.relayRunning === true,
      paired: payload.paired === true,
      deviceId: payload.deviceId,
      qrActive: payload.qrActive,
      at: new Date().toISOString(),
    };
    recordSurveyHubRelayDiagnostic(relay);
    return relay;
  } catch (error) {
    const relay: SurveyHubRelayDiagnostic = {
      relayRunning: false,
      paired: false,
      at: new Date().toISOString(),
      reason: error instanceof Error ? error.message : "relay status unavailable",
    };
    recordSurveyHubRelayDiagnostic(relay);
    return relay;
  }
}

export function formatHubConnectStepLabel(stepId: string): string {
  switch (stepId) {
    case "mirage":
      return "Echo ↔ Mirage";
    case "powerfist-echo":
      return "Echo ↔ PowerFist";
    case "powerfist-hub":
      return "Mirage ↔ PowerFist hub";
    default:
      return stepId;
  }
}
