import WebSocket from "ws";
import { capturePrimaryMonitorPng } from "./capture.mjs";
import * as logger from "./logger.mjs";

/**
 * @typedef {"disconnected"|"connecting"|"connected"|"error"} WsRuntimeStatus
 */

/**
 * @param {import('./config.mjs').SatelliteCredentials} creds
 * @param {{ onStatus?: (status: WsRuntimeStatus) => void, onMission?: (detail: { missionId: string, ok: boolean, reason?: string }) => void }} callbacks
 */
export function startWsClient(creds, callbacks) {
  const url = new URL(`ws://${creds.wsHost}:${creds.wsPort}`);
  url.searchParams.set("role", "capture-deck");
  url.searchParams.set("token", creds.captureToken);
  url.searchParams.set("nodeId", creds.nodeId);

  /** @type {WebSocket | null} */
  let socket = null;
  let closed = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let retryTimer = null;
  /** @type {WsRuntimeStatus} */
  let status = "disconnected";
  let missionsHandled = 0;
  /** @type {string | null} */
  let lastError = null;
  /** @type {string | null} */
  let lastMissionId = null;

  const setStatus = (next) => {
    status = next;
    callbacks.onStatus?.(next);
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    socket = new WebSocket(url.toString());

    socket.on("open", () => {
      setStatus("connected");
      logger.log("ws: connected to Mirage capture-deck relay");
    });

    socket.on("message", (data) => {
      void handleMessage(String(data));
    });

    socket.on("error", () => {
      setStatus("error");
      lastError = "WebSocket error";
    });

    socket.on("close", () => {
      socket = null;
      if (closed) {
        setStatus("disconnected");
        return;
      }
      setStatus("disconnected");
      retryTimer = setTimeout(connect, 2500);
    });
  };

  async function handleMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    if (parsed.type !== "mission" || parsed.kind !== "silent-capture-solve") return;

    lastMissionId = parsed.missionId ?? null;
    try {
      const capture = await capturePrimaryMonitorPng();
      const response = await fetch(parsed.ingestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: parsed.missionId,
          kind: parsed.kind,
          missionSecret: parsed.missionSecret,
          prompt: parsed.prompt,
          pngBase64: capture.pngBase64,
        }),
      });
      const payload = await response.json();
      missionsHandled += 1;
      const ok = payload?.ok === true;
      if (!ok) lastError = payload?.reason ?? "Ingest failed";
      callbacks.onMission?.({
        missionId: parsed.missionId,
        ok,
        reason: payload?.reason,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Mission failed";
      lastError = reason;
      callbacks.onMission?.({ missionId: parsed.missionId ?? "unknown", ok: false, reason });
    }
  }

  connect();

  return {
    getStatus: () => status,
    getStats: () => ({ missionsHandled, lastError, lastMissionId }),
    stop: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socket = null;
      setStatus("disconnected");
    },
  };
}
