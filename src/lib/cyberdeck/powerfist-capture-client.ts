import type { SurveyMissionEnvelope } from "@/lib/cyberdeck/powerfist-mission.types";
import {
  SURVEY_ECHO_NODE_LABEL,
  getOrCreateSurveyNodeId,
} from "@/lib/cyberdeck/survey-mode";
import type { PowerfistSocketStatus } from "@/lib/cyberdeck/survey-hub-socket";

const SURVEY_CAPTURE_HOST_STORAGE_KEY = "echo-mirage-survey-capture-host";
const SURVEY_CAPTURE_PORT_STORAGE_KEY = "echo-mirage-survey-capture-port";
const SURVEY_CAPTURE_TOKEN_STORAGE_KEY = "echo-mirage-survey-capture-token";
const SURVEY_CAPTURE_NODE_STORAGE_KEY = "echo-mirage-survey-capture-node";
const SURVEY_MIRAGE_HUB_HOST_STORAGE_KEY = "echo-mirage-survey-mirage-hub-host";
const SURVEY_MIRAGE_HUB_HTTP_PORT_STORAGE_KEY = "echo-mirage-survey-mirage-hub-http-port";

const LEGACY_CAPTURE_HOST_STORAGE_KEY = "echo-mirage-espionage-capture-host";
const LEGACY_CAPTURE_PORT_STORAGE_KEY = "echo-mirage-espionage-capture-port";
const LEGACY_CAPTURE_TOKEN_STORAGE_KEY = "echo-mirage-espionage-capture-token";
const LEGACY_CAPTURE_NODE_STORAGE_KEY = "echo-mirage-espionage-capture-node";
const LEGACY_MIRAGE_HUB_HOST_STORAGE_KEY = "echo-mirage-espionage-mirage-hub-host";
const LEGACY_MIRAGE_HUB_HTTP_PORT_STORAGE_KEY = "echo-mirage-espionage-mirage-hub-http-port";

function readStorageWithLegacyFallback(surveyKey: string, legacyKey: string): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(surveyKey)?.trim();
  if (current) return current;
  const legacy = window.localStorage.getItem(legacyKey)?.trim();
  if (!legacy) return null;
  window.localStorage.setItem(surveyKey, legacy);
  return legacy;
}

export type PowerfistCapturePairParams = {
  pairId: string;
  pairSecret: string;
  mirageHost?: string;
  mirageHttpPort?: number;
};

export type PowerfistCapturePairCompleteResult =
  | { ok: true; captureToken: string; nodeId: string; wsHost: string; wsPort: number }
  | { ok: false; reason: string };

export function readPowerfistCapturePairParamsFromQuery(): PowerfistCapturePairParams | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const pairId = params.get("pairId")?.trim();
  const pairSecret = params.get("pairSecret")?.trim();
  if (!pairId || !pairSecret) return null;
  const mirageHost = params.get("mirageHost")?.trim() || undefined;
  const mirageHttpPortRaw = params.get("mirageHttpPort")?.trim();
  const mirageHttpPort = mirageHttpPortRaw ? Number(mirageHttpPortRaw) : undefined;
  return {
    pairId,
    pairSecret,
    mirageHost,
    mirageHttpPort: Number.isFinite(mirageHttpPort) && mirageHttpPort! > 0 ? mirageHttpPort : undefined,
  };
}

export function saveMirageHubCredentials(mirageHost: string, mirageHttpPort: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_MIRAGE_HUB_HOST_STORAGE_KEY, mirageHost);
  window.localStorage.setItem(SURVEY_MIRAGE_HUB_HTTP_PORT_STORAGE_KEY, String(mirageHttpPort));
}

export function readMirageHubCredentials(): { mirageHost: string; mirageHttpPort: number } | null {
  if (typeof window === "undefined") return null;
  const mirageHost = readStorageWithLegacyFallback(
    SURVEY_MIRAGE_HUB_HOST_STORAGE_KEY,
    LEGACY_MIRAGE_HUB_HOST_STORAGE_KEY,
  );
  const portRaw = readStorageWithLegacyFallback(
    SURVEY_MIRAGE_HUB_HTTP_PORT_STORAGE_KEY,
    LEGACY_MIRAGE_HUB_HTTP_PORT_STORAGE_KEY,
  );
  const mirageHttpPort = Number(portRaw);
  if (!mirageHost || !Number.isFinite(mirageHttpPort) || mirageHttpPort <= 0) return null;
  return { mirageHost, mirageHttpPort };
}

export function savePowerfistCaptureCredentials(
  host: string,
  port: number,
  captureToken: string,
  nodeId: string,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SURVEY_CAPTURE_HOST_STORAGE_KEY, host);
  window.localStorage.setItem(SURVEY_CAPTURE_PORT_STORAGE_KEY, String(port));
  window.localStorage.setItem(SURVEY_CAPTURE_TOKEN_STORAGE_KEY, captureToken);
  window.localStorage.setItem(SURVEY_CAPTURE_NODE_STORAGE_KEY, nodeId);
}

export function readPowerfistCaptureCredentials(): {
  host: string;
  port: number;
  captureToken: string;
  nodeId: string;
} | null {
  if (typeof window === "undefined") return null;
  const host = readStorageWithLegacyFallback(
    SURVEY_CAPTURE_HOST_STORAGE_KEY,
    LEGACY_CAPTURE_HOST_STORAGE_KEY,
  );
  const portRaw = readStorageWithLegacyFallback(
    SURVEY_CAPTURE_PORT_STORAGE_KEY,
    LEGACY_CAPTURE_PORT_STORAGE_KEY,
  );
  const captureToken = readStorageWithLegacyFallback(
    SURVEY_CAPTURE_TOKEN_STORAGE_KEY,
    LEGACY_CAPTURE_TOKEN_STORAGE_KEY,
  );
  const nodeId = readStorageWithLegacyFallback(
    SURVEY_CAPTURE_NODE_STORAGE_KEY,
    LEGACY_CAPTURE_NODE_STORAGE_KEY,
  );
  const port = Number(portRaw);
  if (!host || !captureToken || !nodeId || !Number.isFinite(port) || port <= 0) return null;
  return { host, port, captureToken, nodeId };
}

export function buildPowerfistCaptureWsUrl(
  host: string,
  port: number,
  captureToken: string,
  nodeId: string,
): string {
  const url = new URL(`ws://${host}:${port}`);
  url.searchParams.set("role", "capture-deck");
  url.searchParams.set("token", captureToken);
  url.searchParams.set("nodeId", nodeId);
  return url.toString();
}

export async function completePowerfistCapturePairFromQr(
  params: PowerfistCapturePairParams,
): Promise<PowerfistCapturePairCompleteResult> {
  const nodeId = getOrCreateSurveyNodeId();
  const mirageHub =
    params.mirageHost && params.mirageHttpPort
      ? { mirageHost: params.mirageHost, mirageHttpPort: params.mirageHttpPort }
      : readMirageHubCredentials();

  try {
    const res = await fetch(
      mirageHub
        ? "/api/survey/relay/pair-capture"
        : "/api/powerfist/pair/capture",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mirageHub
            ? {
                mirageHost: mirageHub.mirageHost,
                mirageHttpPort: mirageHub.mirageHttpPort,
                pairId: params.pairId,
                pairSecret: params.pairSecret,
                nodeId,
              }
            : {
                pairId: params.pairId,
                pairSecret: params.pairSecret,
                nodeId,
                label: SURVEY_ECHO_NODE_LABEL,
              },
        ),
      },
    );
    const payload = (await res.json()) as PowerfistCapturePairCompleteResult;
    if (payload.ok && mirageHub) {
      saveMirageHubCredentials(mirageHub.mirageHost, mirageHub.mirageHttpPort);
    }
    return payload;
  } catch {
    return { ok: false, reason: "Echo pair request failed." };
  }
}

async function runEchoSilentCapture(): Promise<{ ok: true; pngBase64: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/survey/capture", { method: "POST" });
    const payload = (await res.json()) as { ok?: boolean; pngBase64?: string; error?: string };
    if (!payload.ok || !payload.pngBase64?.trim()) {
      return { ok: false, error: payload.error || "Echo capture failed." };
    }
    return { ok: true, pngBase64: payload.pngBase64.trim() };
  } catch {
    return { ok: false, error: "Echo capture request failed." };
  }
}

async function ingestEchoCaptureToMirage(
  envelope: SurveyMissionEnvelope,
  pngBase64: string,
): Promise<{ ok: boolean; reason?: string }> {
  const mirageHub = readMirageHubCredentials();
  try {
    const res = await fetch(
      mirageHub ? "/api/survey/relay/mission-ingest" : envelope.ingestUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mirageHub
            ? {
                ingestUrl: envelope.ingestUrl,
                missionId: envelope.missionId,
                kind: envelope.kind,
                missionSecret: envelope.missionSecret,
                prompt: envelope.prompt,
                pngBase64,
              }
            : {
                missionId: envelope.missionId,
                kind: envelope.kind,
                missionSecret: envelope.missionSecret,
                prompt: envelope.prompt,
                pngBase64,
              },
        ),
      },
    );
    const payload = (await res.json()) as { ok?: boolean; reason?: string };
    return { ok: payload.ok === true, reason: payload.reason };
  } catch {
    return { ok: false, reason: "Mirage ingest failed." };
  }
}

type CaptureSocketController = {
  getStatus: () => PowerfistSocketStatus;
  close: () => void;
};

export function connectPowerfistCaptureSocket(options: {
  wsUrl: string;
  onStatus?: (status: PowerfistSocketStatus) => void;
  onMissionResult?: (detail: { missionId: string; ok: boolean; reason?: string }) => void;
}): CaptureSocketController {
  let status: PowerfistSocketStatus = "disconnected";
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: PowerfistSocketStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  const handleMission = async (envelope: SurveyMissionEnvelope) => {
    const captured = await runEchoSilentCapture();
    if (!captured.ok) {
      options.onMissionResult?.({
        missionId: envelope.missionId,
        ok: false,
        reason: captured.error,
      });
      return;
    }

    const ingested = await ingestEchoCaptureToMirage(envelope, captured.pngBase64);
    options.onMissionResult?.({
      missionId: envelope.missionId,
      ok: ingested.ok,
      reason: ingested.reason,
    });
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    ws = new WebSocket(options.wsUrl);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const message = parsed as SurveyMissionEnvelope & { type?: string };
      if (message.type !== "mission" || message.kind !== "silent-capture-solve") return;
      void handleMission(message);
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      ws = null;
      if (closed) {
        setStatus("disconnected");
        return;
      }
      setStatus("disconnected");
      retryTimer = setTimeout(connect, 2500);
    };
  };

  connect();

  return {
    getStatus: () => status,
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      ws = null;
      setStatus("disconnected");
    },
  };
}
