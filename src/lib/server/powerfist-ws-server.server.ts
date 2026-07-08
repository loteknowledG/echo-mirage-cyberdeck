// SERVER ONLY — WebSocket relay: phone remote, solver deck, capture deck.

import crypto from "crypto";
import os from "os";
import { WebSocket, WebSocketServer } from "ws";
import type { PowerFistStackCommand } from "@/lib/cyberdeck/powerfist-events";
import type {
  PowerfistMissionEnvelope,
  PowerfistMissionSolveDetail,
} from "@/lib/cyberdeck/powerfist-mission.types";
import { resolveHttpPort } from "@/lib/server/is-localhost-request.server";
import {
  broadcastPowerfistMissionSolveExternal,
  broadcastPowerfistMissionToCaptureExternal,
  powerfistExternalHubEnabled,
  waitForExternalPowerfistHubHealth,
} from "@/lib/server/powerfist-hub-bridge.server";
import {
  buildSilentCaptureMissionEnvelope,
  loadPowerfistPairingRegistry,
  savePowerfistPairingRegistry,
  validatePowerfistCaptureToken,
  validatePowerfistDeckToken,
  validatePowerfistRemoteToken,
} from "@/lib/server/powerfist-pairing-registry.server";
import {
  readPowerfistPairingState,
  type PowerfistPairingState,
} from "@/lib/server/powerfist-pairing-state.server";

type PowerfistWsRole = "deck" | "remote" | "capture-deck";

type PowerfistWsHub = {
  wss: WebSocketServer;
  state: PowerfistPairingState;
  deckClients: Set<WebSocket>;
  captureClients: Map<string, WebSocket>;
  remoteClients: Map<string, WebSocket>;
};

const GLOBAL_KEY = "__echoMiragePowerfistWs";

function getHub(): PowerfistWsHub | null {
  return (globalThis as typeof globalThis & { [GLOBAL_KEY]?: PowerfistWsHub })[GLOBAL_KEY] ?? null;
}

function getLanHosts(): string[] {
  const addrs: string[] = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
  return addrs.length > 0 ? addrs : ["127.0.0.1"];
}

function isPowerfistStackCommand(value: unknown): value is PowerFistStackCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as PowerFistStackCommand;
  return (
    command.kind === "powerfist-stack-push" &&
    typeof command.commandId === "string" &&
    typeof command.message === "string" &&
    command.card != null &&
    typeof command.card.title === "string"
  );
}

function resolveWsPort(): number {
  const explicit = Number(process.env.ECHO_MIRAGE_POWERFIST_WS_PORT);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const httpPort = Number(process.env.PORT);
  if (Number.isFinite(httpPort) && httpPort > 0) return httpPort + 2;
  return 3052;
}

function resolveBindHost(): string {
  return process.env.ECHO_MIRAGE_POWERFIST_WS_HOST?.trim() || "0.0.0.0";
}

async function resolveDeckToken(existing: PowerfistPairingState | null): Promise<string> {
  const fromEnv = process.env.ECHO_MIRAGE_POWERFIST_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (existing?.deckToken) return existing.deckToken;
  if (existing?.token) return existing.token;
  return crypto.randomBytes(24).toString("hex");
}

function parseRole(url: string | undefined): PowerfistWsRole | null {
  if (!url) return null;
  try {
    const role = new URL(url, "http://localhost").searchParams.get("role");
    if (role === "deck" || role === "remote" || role === "capture-deck") return role;
  } catch {
    /* invalid URL */
  }
  return null;
}

function parseQueryParam(url: string | undefined, key: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, "http://localhost").searchParams.get(key);
  } catch {
    return null;
  }
}

function broadcastToSet(clients: Set<WebSocket>, payload: string): number {
  let delivered = 0;
  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(payload);
    delivered += 1;
  }
  return delivered;
}

export async function broadcastPowerfistMissionToCapture(
  envelope: PowerfistMissionEnvelope,
): Promise<number> {
  const external = await broadcastPowerfistMissionToCaptureExternal(envelope);
  if (external !== null) return external;
  const hub = getHub();
  if (!hub) return 0;
  let delivered = 0;
  for (const client of hub.captureClients.values()) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(envelope));
    delivered += 1;
  }
  return delivered;
}

export async function broadcastPowerfistMissionSolve(
  detail: PowerfistMissionSolveDetail,
): Promise<number> {
  const external = await broadcastPowerfistMissionSolveExternal(detail);
  if (external !== null) {
    return external;
  }
  const hub = getHub();
  if (!hub) return 0;
  return broadcastToSet(
    hub.deckClients,
    JSON.stringify({ type: "mission-solve", ...detail }),
  );
}

export async function ensurePowerfistWsServer(): Promise<PowerfistPairingState | null> {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: PowerfistWsHub;
  };
  if (globalStore[GLOBAL_KEY]) {
    return globalStore[GLOBAL_KEY].state;
  }

  const existing = await readPowerfistPairingState();
  if (powerfistExternalHubEnabled()) {
    const healthy = await waitForExternalPowerfistHubHealth();
    if (healthy && existing?.deckToken) {
      return existing;
    }
  }

  const port = resolveWsPort();
  const bindHost = resolveBindHost();
  const deckToken = await resolveDeckToken(existing);

  const deckClients = new Set<WebSocket>();
  const captureClients = new Map<string, WebSocket>();
  const remoteClients = new Map<string, WebSocket>();

  let wss: WebSocketServer;
  try {
    wss = new WebSocketServer({ port, host: bindHost });
  } catch (error) {
    console.warn("[powerfist-ws] failed to bind", error);
    return existing;
  }

  wss.on("connection", (ws, req) => {
    void (async () => {
      const role = parseRole(req.url);
      const clientToken = parseQueryParam(req.url, "token");
      const deviceId = parseQueryParam(req.url, "deviceId");
      const nodeId = parseQueryParam(req.url, "nodeId");
      const state = await loadPowerfistPairingRegistry();

      if (!role || !clientToken) {
        ws.close(4403, "unauthorized");
        return;
      }

      if (role === "deck") {
        if (!validatePowerfistDeckToken(state, clientToken)) {
          ws.close(4403, "unauthorized");
          return;
        }
        deckClients.add(ws);
        ws.send(JSON.stringify({ type: "connected", role: "deck" }));
      } else if (role === "capture-deck") {
        if (!nodeId || !validatePowerfistCaptureToken(state, clientToken, nodeId)) {
          ws.close(4403, "unauthorized");
          return;
        }
        const prior = captureClients.get(nodeId);
        if (prior && prior !== ws) prior.close(4409, "replaced");
        captureClients.set(nodeId, ws);
        ws.send(JSON.stringify({ type: "connected", role: "capture-deck" }));
      } else {
        if (!deviceId || !validatePowerfistRemoteToken(state, clientToken, deviceId)) {
          ws.close(4403, "unauthorized");
          return;
        }
        const priorRemote = remoteClients.get(deviceId);
        if (priorRemote && priorRemote !== ws) priorRemote.close(4409, "replaced");
        remoteClients.set(deviceId, ws);
        ws.send(JSON.stringify({ type: "connected", role: "remote" }));
      }

      ws.on("message", (raw) => {
        if (role !== "remote") return;
        void (async () => {
          const latest = await loadPowerfistPairingRegistry();
          if (!deviceId || !validatePowerfistRemoteToken(latest, clientToken, deviceId)) {
            ws.close(4403, "unauthorized");
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(String(raw));
          } catch {
            ws.send(JSON.stringify({ type: "error", message: "invalid json" }));
            return;
          }

          if (!parsed || typeof parsed !== "object") return;
          const message = parsed as { type?: string; command?: unknown; mission?: string };

          if (message.type === "mission" && message.mission === "silent-capture-solve") {
            const built = await buildSilentCaptureMissionEnvelope();
            if (!built.ok) {
              ws.send(JSON.stringify({ type: "mission-ack", ok: false, reason: built.reason }));
              return;
            }
            const delivered = await broadcastPowerfistMissionToCapture(built.envelope);
            ws.send(
              JSON.stringify({
                type: "mission-ack",
                ok: delivered > 0,
                missionId: built.envelope.missionId,
                delivered,
                reason: delivered > 0 ? undefined : "capture desk offline",
              }),
            );
            return;
          }

          if (message.type !== "stack-push") {
            ws.send(JSON.stringify({ type: "error", message: "unsupported message type" }));
            return;
          }

          if (!isPowerfistStackCommand(message.command)) {
            ws.send(JSON.stringify({ type: "error", message: "invalid stack command" }));
            return;
          }

          const delivered = broadcastToSet(
            deckClients,
            JSON.stringify({ type: "stack-push", command: message.command }),
          );

          ws.send(
            JSON.stringify({
              type: "stack-push-ack",
              commandId: (message.command as PowerFistStackCommand).commandId,
              delivered,
            }),
          );
        })();
      });

      ws.on("close", () => {
        if (role === "deck") {
          deckClients.delete(ws);
          return;
        }
        if (role === "capture-deck" && nodeId && captureClients.get(nodeId) === ws) {
          captureClients.delete(nodeId);
          return;
        }
        if (deviceId && remoteClients.get(deviceId) === ws) {
          remoteClients.delete(deviceId);
        }
      });
    })();
  });

  wss.on("error", (error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.warn(`[powerfist-ws] port ${port} already in use`);
      return;
    }
    console.error("[powerfist-ws]", error);
  });

  const state: PowerfistPairingState = {
    port,
    bindHost,
    deckToken,
    lanHosts: getLanHosts(),
    httpPort: resolveHttpPort(),
    updatedAt: new Date().toISOString(),
    missionSecret: existing?.missionSecret,
    pairingSession: existing?.pairingSession ?? null,
    capturePairingSession: existing?.capturePairingSession ?? null,
    pairedRemote: existing?.pairedRemote ?? null,
    pairedCapture: existing?.pairedCapture ?? null,
    mirageNode: existing?.mirageNode ?? null,
  };

  await savePowerfistPairingRegistry(state);
  globalStore[GLOBAL_KEY] = {
    wss,
    state,
    deckClients,
    captureClients,
    remoteClients,
  };

  console.log(
    `[powerfist-ws] listening on ws://${bindHost}:${port} (deck token ${deckToken.slice(0, 8)}…)`,
  );

  return state;
}
