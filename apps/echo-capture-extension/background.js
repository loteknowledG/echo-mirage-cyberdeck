import {
  clearCredentials,
  loadCredentials,
  pairFromCaptureUrl,
} from "./lib/pair.js";
import {
  captureFocusedTabPngBase64,
  ingestMissionCapture,
  startCaptureDeckSocket,
} from "./lib/ws.js";

/** @type {ReturnType<typeof startCaptureDeckSocket> | null} */
let socketClient = null;

async function broadcastStatus() {
  const creds = await loadCredentials();
  const status = socketClient?.getStatus() ?? "disconnected";
  chrome.runtime.sendMessage({
    type: "echo-capture-status",
    armed: Boolean(creds),
    wsStatus: status,
  }).catch(() => {
    /* no popup open */
  });
}

async function armSocket() {
  const creds = await loadCredentials();
  socketClient?.stop();
  socketClient = null;
  if (!creds) {
    await broadcastStatus();
    return;
  }

  socketClient = startCaptureDeckSocket(creds, {
    onStatus: () => {
      void broadcastStatus();
    },
    onMission: (mission) => {
      void handleMission(mission);
    },
  });
  await broadcastStatus();
}

async function handleMission(mission) {
  const capture = await captureFocusedTabPngBase64();
  if (!capture.ok) {
    console.warn("Echo Capture mission failed:", capture.reason);
    return;
  }
  await ingestMissionCapture(mission, capture.pngBase64);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    switch (message?.type) {
      case "echo-capture-get-status": {
        const creds = await loadCredentials();
        sendResponse({
          ok: true,
          armed: Boolean(creds),
          wsStatus: socketClient?.getStatus() ?? "disconnected",
        });
        return;
      }
      case "echo-capture-pair": {
        const result = await pairFromCaptureUrl(String(message.url ?? ""));
        if (result.ok) {
          await armSocket();
        }
        sendResponse(result);
        return;
      }
      case "echo-capture-disarm": {
        await clearCredentials();
        socketClient?.stop();
        socketClient = null;
        await broadcastStatus();
        sendResponse({ ok: true });
        return;
      }
      default:
        sendResponse({ ok: false, reason: "Unknown message." });
    }
  })();
  return true;
});

void armSocket();
