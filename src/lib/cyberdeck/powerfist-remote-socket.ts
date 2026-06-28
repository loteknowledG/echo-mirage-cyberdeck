import type { PowerFistStackCommand } from "@/lib/cyberdeck/powerfist-events";
import type { EspionageMissionSolveDetail } from "@/lib/cyberdeck/powerfist-mission.types";

export type PowerfistSocketStatus = "disconnected" | "connecting" | "connected" | "error" | "pairing";

export type PowerfistDeckConnectInfo = {
  ok: boolean;
  deckWsUrl?: string;
  wsPort?: number;
  lanHosts?: string[];
  reason?: string;
};

export type PowerfistQrSession = {
  ok: true;
  previewUrl: string | null;
  expiresAt: string | null;
  pairedRemote: { deviceId: string; pairedAt: string } | null;
  capturePairUrl?: string | null;
  captureExpiresAt?: string | null;
  pairedCapture?: { nodeId: string; pairedAt: string; label?: string } | null;
  mirageNode?: { nodeId: string; pairedAt: string } | null;
};

export type PowerfistPairCompleteResult =
  | {
      ok: true;
      remoteToken: string;
      deviceId: string;
      wsHost: string;
      wsPort: number;
    }
  | { ok: false; reason: string };

const DEVICE_ID_STORAGE_KEY = "echo-mirage-powerfist-device-id";
const REMOTE_HOST_STORAGE_KEY = "echo-mirage-powerfist-remote-host";
const REMOTE_PORT_STORAGE_KEY = "echo-mirage-powerfist-remote-port";
const REMOTE_TOKEN_STORAGE_KEY = "echo-mirage-powerfist-remote-token";

export function getOrCreatePowerfistDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export function buildPowerfistRemoteWsUrl(
  host: string,
  port: number,
  remoteToken: string,
  deviceId: string,
): string {
  const url = new URL(`ws://${host}:${port}`);
  url.searchParams.set("role", "remote");
  url.searchParams.set("token", remoteToken);
  url.searchParams.set("deviceId", deviceId);
  return url.toString();
}

export function savePowerfistRemoteCredentials(
  host: string,
  port: number,
  remoteToken: string,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMOTE_HOST_STORAGE_KEY, host);
  window.localStorage.setItem(REMOTE_PORT_STORAGE_KEY, String(port));
  window.localStorage.setItem(REMOTE_TOKEN_STORAGE_KEY, remoteToken);
}

export function readPowerfistRemoteCredentials(): {
  host: string;
  port: number;
  remoteToken: string;
  deviceId: string;
} | null {
  if (typeof window === "undefined") return null;
  const host = window.localStorage.getItem(REMOTE_HOST_STORAGE_KEY)?.trim();
  const portRaw = window.localStorage.getItem(REMOTE_PORT_STORAGE_KEY)?.trim();
  const remoteToken = window.localStorage.getItem(REMOTE_TOKEN_STORAGE_KEY)?.trim();
  const deviceId = getOrCreatePowerfistDeviceId();
  const port = Number(portRaw);
  if (!host || !remoteToken || !Number.isFinite(port) || port <= 0) return null;
  return { host, port, remoteToken, deviceId };
}

export function readPowerfistPairParamsFromQuery(): { pairId: string; pairSecret: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const pairId = params.get("pairId")?.trim();
  const pairSecret = params.get("pairSecret")?.trim();
  if (!pairId || !pairSecret) return null;
  return { pairId, pairSecret };
}

export function clearPowerfistPairQueryFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("pairId");
  url.searchParams.delete("pairSecret");
  window.history.replaceState({}, "", url.toString());
}

export async function fetchPowerfistDeckConnect(): Promise<PowerfistDeckConnectInfo> {
  try {
    const res = await fetch("/api/powerfist/pairing/deck", { cache: "no-store" });
    return (await res.json()) as PowerfistDeckConnectInfo;
  } catch {
    return { ok: false, reason: "deck connect fetch failed" };
  }
}

export async function fetchPowerfistQrSession(): Promise<PowerfistQrSession | { ok: false; reason: string }> {
  try {
    const res = await fetch("/api/powerfist/pairing/qr", { cache: "no-store" });
    return (await res.json()) as PowerfistQrSession | { ok: false; reason: string };
  } catch {
    return { ok: false, reason: "qr session fetch failed" };
  }
}

export async function createPowerfistQrSession(): Promise<
  | { ok: true; previewUrl: string; expiresAt: string; pairedRemote: { deviceId: string; pairedAt: string } | null }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/powerfist/pairing/qr", { method: "POST" });
    return (await res.json()) as
      | { ok: true; previewUrl: string; expiresAt: string; pairedRemote: { deviceId: string; pairedAt: string } | null }
      | { ok: false; reason: string };
  } catch {
    return { ok: false, reason: "qr session create failed" };
  }
}

export async function createPowerfistCaptureQrSession(args: {
  echoHost: string;
  echoHttpPort: number;
}): Promise<
  | {
      ok: true;
      capturePairUrl: string;
      expiresAt: string;
      pairedCapture: { nodeId: string; pairedAt: string; label?: string } | null;
    }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/powerfist/pairing/capture/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    return (await res.json()) as
      | {
          ok: true;
          capturePairUrl: string;
          expiresAt: string;
          pairedCapture: { nodeId: string; pairedAt: string; label?: string } | null;
        }
      | { ok: false; reason: string };
  } catch {
    return { ok: false, reason: "Echo QR session create failed." };
  }
}

export async function unpairPowerfistCapture(): Promise<boolean> {
  try {
    const res = await fetch("/api/powerfist/pairing/capture/unpair", { method: "POST" });
    const payload = (await res.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

export async function unpairPowerfistRemote(): Promise<boolean> {
  try {
    const res = await fetch("/api/powerfist/pairing/unpair", { method: "POST" });
    const payload = (await res.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

export async function completePowerfistPairFromQr(
  pairId: string,
  pairSecret: string,
): Promise<PowerfistPairCompleteResult> {
  const deviceId = getOrCreatePowerfistDeviceId();
  try {
    const res = await fetch("/api/powerfist/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairId, pairSecret, deviceId }),
    });
    const payload = (await res.json()) as PowerfistPairCompleteResult;
    if (payload.ok) {
      savePowerfistRemoteCredentials(payload.wsHost, payload.wsPort, payload.remoteToken);
    }
    return payload;
  } catch {
    return { ok: false, reason: "Pair request failed." };
  }
}

type SocketController = {
  getStatus: () => PowerfistSocketStatus;
  close: () => void;
};

function attachReconnectingSocket(options: {
  wsUrl: string;
  role: "deck" | "remote";
  onStackPush?: (command: PowerFistStackCommand) => void;
  onMissionSolve?: (detail: EspionageMissionSolveDetail) => void;
  onStatus?: (status: PowerfistSocketStatus) => void;
}): SocketController {
  let status: PowerfistSocketStatus = "disconnected";
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: PowerfistSocketStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    ws = new WebSocket(options.wsUrl);

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      if (options.role !== "deck") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const message = parsed as {
        type?: string;
        command?: PowerFistStackCommand;
        missionId?: string;
        kind?: EspionageMissionSolveDetail["kind"];
        imageDataUrl?: string;
        prompt?: string;
      };
      if (message.type === "stack-push" && message.command && options.onStackPush) {
        options.onStackPush(message.command);
        return;
      }
      if (
        message.type === "mission-solve" &&
        message.missionId &&
        message.imageDataUrl &&
        message.prompt &&
        options.onMissionSolve
      ) {
        options.onMissionSolve({
          missionId: message.missionId,
          kind: message.kind ?? "silent-capture-solve",
          imageDataUrl: message.imageDataUrl,
          prompt: message.prompt,
        });
      }
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

export function connectPowerfistDeckSocket(options: {
  wsUrl: string;
  onStackPush: (command: PowerFistStackCommand) => void;
  onMissionSolve?: (detail: EspionageMissionSolveDetail) => void;
  onStatus?: (status: PowerfistSocketStatus) => void;
}): SocketController {
  return attachReconnectingSocket({ ...options, role: "deck" });
}

export function connectPowerfistRemoteSocket(options: {
  wsUrl: string;
  onStatus?: (status: PowerfistSocketStatus) => void;
}): SocketController & {
  sendStackPush: (command: PowerFistStackCommand) => Promise<{ ok: boolean; delivered?: number; error?: string }>;
  sendEspionageCaptureMission: () => Promise<{ ok: boolean; missionId?: string; error?: string }>;
} {
  let ws: WebSocket | null = null;
  let status: PowerfistSocketStatus = "disconnected";
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const pending: Array<{
    command: PowerFistStackCommand;
    resolve: (result: { ok: boolean; delivered?: number; error?: string }) => void;
  }> = [];
  const pendingMissions: Array<{
    resolve: (result: { ok: boolean; missionId?: string; error?: string }) => void;
  }> = [];

  const setStatus = (next: PowerfistSocketStatus) => {
    status = next;
    options.onStatus?.(next);
  };

  const flushPending = (error: string) => {
    while (pending.length > 0) {
      const entry = pending.shift();
      entry?.resolve({ ok: false, error });
    }
    while (pendingMissions.length > 0) {
      const entry = pendingMissions.shift();
      entry?.resolve({ ok: false, error });
    }
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
      const message = parsed as {
        type?: string;
        commandId?: string;
        delivered?: number;
        ok?: boolean;
        missionId?: string;
        reason?: string;
      };
      if (message.type === "mission-ack") {
        const entry = pendingMissions.shift();
        entry?.resolve({
          ok: message.ok === true,
          missionId: message.missionId,
          error: message.ok ? undefined : message.reason || "mission failed",
        });
        return;
      }
      if (message.type !== "stack-push-ack") return;
      const index = pending.findIndex((entry) => entry.command.commandId === message.commandId);
      if (index === -1) return;
      const [entry] = pending.splice(index, 1);
      entry.resolve({
        ok: (message.delivered ?? 0) > 0,
        delivered: message.delivered,
        error: (message.delivered ?? 0) > 0 ? undefined : "no desktop deck connected",
      });
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      ws = null;
      flushPending("socket disconnected");
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
      flushPending("socket closed");
      setStatus("disconnected");
    },
    sendStackPush: (command) =>
      new Promise((resolve) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ ok: false, error: "remote socket not connected" });
          return;
        }
        pending.push({ command, resolve });
        ws.send(JSON.stringify({ type: "stack-push", command }));
        setTimeout(() => {
          const index = pending.findIndex((entry) => entry.command.commandId === command.commandId);
          if (index === -1) return;
          pending.splice(index, 1);
          resolve({ ok: false, error: "push timed out" });
        }, 8000);
      }),
    sendEspionageCaptureMission: () =>
      new Promise((resolve) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ ok: false, error: "PowerFist remote socket not connected" });
          return;
        }
        const entry = { resolve };
        pendingMissions.push(entry);
        ws.send(JSON.stringify({ type: "mission", mission: "silent-capture-solve" }));
        setTimeout(() => {
          const index = pendingMissions.indexOf(entry);
          if (index === -1) return;
          pendingMissions.splice(index, 1);
          resolve({ ok: false, error: "espionage mission timed out" });
        }, 30_000);
      }),
  };
}
