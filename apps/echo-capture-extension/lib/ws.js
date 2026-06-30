/** @typedef {"disconnected"|"connecting"|"connected"|"error"} WsStatus */

/**
 * @param {import('./pair.js').CaptureCredentials} creds
 * @param {{ onStatus?: (status: WsStatus) => void, onMission?: (message: object) => void }} callbacks
 */
export function startCaptureDeckSocket(creds, callbacks) {
  const url = new URL(`ws://${creds.wsHost}:${creds.wsPort}`);
  url.searchParams.set("role", "capture-deck");
  url.searchParams.set("token", creds.captureToken);
  url.searchParams.set("nodeId", creds.nodeId);

  /** @type {WebSocket | null} */
  let socket = null;
  let closed = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let retryTimer = null;
  /** @type {WsStatus} */
  let status = "disconnected";

  const setStatus = (next) => {
    status = next;
    callbacks.onStatus?.(next);
  };

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    socket = new WebSocket(url.toString());

    socket.onopen = () => setStatus("connected");
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        if (parsed?.type === "mission" && parsed?.kind === "silent-capture-solve") {
          callbacks.onMission?.(parsed);
        }
      } catch {
        /* ignore */
      }
    };
    socket.onerror = () => setStatus("error");
    socket.onclose = () => {
      socket = null;
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
    stop: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socket = null;
      setStatus("disconnected");
    },
  };
}

/**
 * @param {object} mission
 * @param {string} pngBase64
 */
export async function ingestMissionCapture(mission, pngBase64) {
  const response = await fetch(String(mission.ingestUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      missionId: mission.missionId,
      kind: mission.kind,
      missionSecret: mission.missionSecret,
      prompt: mission.prompt,
      pngBase64,
    }),
  });
  return response.json();
}

/** @returns {Promise<{ ok: true, pngBase64: string } | { ok: false, reason: string }>} */
export async function captureFocusedTabPngBase64() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.windowId) {
    return { ok: false, reason: "No focused tab to capture." };
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  if (!dataUrl?.startsWith("data:image/png;base64,")) {
    return { ok: false, reason: "Tab capture failed." };
  }

  return { ok: true, pngBase64: dataUrl.slice("data:image/png;base64,".length) };
}
