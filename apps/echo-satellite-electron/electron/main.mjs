import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import {
  clearCredentials,
  DEFAULT_PAIR_HTTP_PORT,
  getOrCreateNodeId,
  loadCredentials,
  saveCredentials,
} from "./config.mjs";
import { capturePrimaryMonitorPng } from "./capture.mjs";
import { parseCapturePairUrl, completeCapturePair } from "./pair.mjs";
import { startPairServer } from "./pair-server.mjs";
import { startWsClient } from "./ws-client.mjs";
import { createTrayManager } from "./tray.mjs";
import * as logger from "./logger.mjs";
import {
  getEchoSurveyPairingStatus,
  initSpyEchoPairing,
  refreshEchoSurveyPairCodes,
} from "./spy-echo-pairing.mjs";
import { buildMiragePairingBundle } from "./send-to-mirage.mjs";
import { checkForSatelliteUpdate, downloadAndInstallSatelliteUpdate } from "./updater.mjs";
import {
  pollSurveyRelayPairRequests,
  pushSurveyRelayBundle,
} from "./survey-relay-client.mjs";
import { completeSurveyPairEnterByPin } from "./spy-echo-pairing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const version = app.getVersion();

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof startWsClient> | null} */
let wsClient = null;

/** @type {{ server: import("node:http").Server, surveyTeamHub: ReturnType<typeof import("./survey-team-hub.mjs").attachSurveyTeamHub> } | null} */
let pairServer = null;

let armed = false;
/** @type {"disconnected"|"connecting"|"connected"|"error"} */
let wsStatus = "disconnected";
let missionsHandled = 0;
/** @type {string | null} */
let lastError = null;
/** @type {string | null} */
let lastMissionId = null;
/** @type {import('./config.mjs').SatelliteCredentials | null} */
let cachedCredentials = null;
/** @type {{ reachable: boolean, mirages: Array<{ nodeId: string, pairedAt: string }> }} */
let cachedSpyLinks = { reachable: false, mirages: [] };
/** @type {Awaited<ReturnType<typeof getEchoSurveyPairingStatus>> | null} */
let cachedSpyStatus = null;

let trayIcon = null;
try {
  const iconPath = path.join(__dirname, "..", "public", "icon.ico");
  trayIcon = nativeImage.createFromPath(iconPath);
} catch {
  trayIcon = null;
}

const trayManager = createTrayManager({ app, Tray, Menu, nativeImage: trayIcon });

function statusSnapshot() {
  const stats = wsClient?.getStats();
  return {
    armed,
    wsStatus,
    pairHttpPort: DEFAULT_PAIR_HTTP_PORT,
    lastError: stats?.lastError ?? lastError,
    lastMissionId: stats?.lastMissionId ?? lastMissionId,
    missionsHandled: stats?.missionsHandled ?? missionsHandled,
    spyMirages: cachedSpyLinks.mirages,
    surveyLinksReachable: cachedSpyLinks.reachable,
    captureMirage: cachedCredentials
      ? {
          host: cachedCredentials.mirageHost,
          port: cachedCredentials.mirageHttpPort,
        }
      : null,
  };
}

function stopWs() {
  wsClient?.stop();
  wsClient = null;
  wsStatus = "disconnected";
}

async function armWithCredentials(creds, hideWindow) {
  await saveCredentials(app, creds);
  cachedCredentials = creds;
  stopWs();
  wsClient = startWsClient(creds, {
    onStatus: (status) => {
      wsStatus = status;
      mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
    },
    onMission: () => {
      mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
    },
  });
  armed = true;
  logger.log("armed with Mirage credentials");
  if (hideWindow) trayManager.hideMainWindow();
  mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 640,
    title: "Echo Satellite",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  trayManager.attachWindow(mainWindow);

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:1420");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    logger.step(8, 8, "setup window ready");
    mainWindow?.show();
  });
}

function buildSpyStatusPayload() {
  const snapshot = statusSnapshot();
  const spy = cachedSpyStatus;
  return {
    ok: true,
    source: "echo-satellite",
    echoHost: spy?.echoHost ?? "127.0.0.1",
    httpPort: spy?.httpPort ?? DEFAULT_PAIR_HTTP_PORT,
    miragePin: spy?.miragePin ?? null,
    powerfistPin: spy?.powerfistPin ?? null,
    mirageExpiresAt: spy?.mirageExpiresAt ?? null,
    powerfistExpiresAt: spy?.powerfistExpiresAt ?? null,
    pairedMirages: snapshot.spyMirages,
    pairedMirage: snapshot.spyMirages[0] ?? null,
    pairedPowerfist: spy?.pairedPowerfist ?? null,
    armed: snapshot.armed,
    wsStatus: snapshot.wsStatus,
    captureMirage: snapshot.captureMirage,
    surveyLinksReachable: snapshot.surveyLinksReachable,
  };
}

async function refreshSpyLinks() {
  try {
    cachedSpyStatus = await getEchoSurveyPairingStatus();
    cachedSpyLinks = {
      reachable: true,
      mirages: cachedSpyStatus.pairedMirages.map((mirage) => ({
        nodeId: mirage.nodeId,
        pairedAt: mirage.pairedAt,
      })),
    };
    void pushSurveyRelayBundle(cachedSpyStatus);
    void pollSurveyRelayPairRequests(cachedSpyStatus.echoNodeId, completeSurveyPairEnterByPin);
  } catch (error) {
    cachedSpyStatus = null;
    cachedSpyLinks = { reachable: false, mirages: [] };
    logger.log(
      `spy codes refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
}

async function initializeAfterReady() {
  logger.step(3, 8, "app ready — starting services");
  initSpyEchoPairing(app);

  pairServer = startPairServer({
    app,
    getNodeId: () => getOrCreateNodeId(app),
    onPaired: (creds) => {
      void armWithCredentials(creds, true);
    },
    onSpyPaired: (result) => {
      pairServer?.surveyTeamHub.notifyLinked({
        role: result.role === "powerfist" ? "powerfist" : "mirage",
        nodeId: typeof result.nodeId === "string" ? result.nodeId : undefined,
        deviceId: typeof result.deviceId === "string" ? result.deviceId : undefined,
      });
      void refreshSpyLinks();
    },
    getSpyStatus: () => buildSpyStatusPayload(),
  });

  const saved = await loadCredentials(app);
  cachedCredentials = saved;
  if (saved) {
    logger.step(6, 8, "restoring saved credentials");
    await armWithCredentials(saved, false);
  } else {
    logger.step(6, 8, "no saved credentials — fresh setup");
  }

  void refreshSpyLinks();
  setInterval(() => {
    void refreshSpyLinks();
  }, 5000);

  setTimeout(() => {
    void checkForSatelliteUpdate(version).then((result) => {
      if (result.ok && result.updateAvailable) {
        mainWindow?.webContents.send("satellite:update-available", result);
      }
    });
  }, 8000);

  trayManager.ensureTray();
  logger.step(7, 8, process.platform === "darwin" ? "window-only mode (macOS)" : "system tray ready");
}

function registerIpc() {
  ipcMain.handle("satellite:get-status", () => statusSnapshot());

  ipcMain.handle("satellite:get-spy-codes", async () => {
    const status = await getEchoSurveyPairingStatus();
    cachedSpyStatus = status;
    cachedSpyLinks = {
      reachable: true,
      mirages: status.pairedMirages.map((mirage) => ({
        nodeId: mirage.nodeId,
        pairedAt: mirage.pairedAt,
      })),
    };
    return { ok: true, ...status };
  });

  ipcMain.handle("satellite:regenerate-spy-codes", async () => {
    await refreshEchoSurveyPairCodes();
    const status = await getEchoSurveyPairingStatus();
    cachedSpyStatus = status;
    cachedSpyLinks = {
      reachable: true,
      mirages: status.pairedMirages.map((mirage) => ({
        nodeId: mirage.nodeId,
        pairedAt: mirage.pairedAt,
      })),
    };
    mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
    return { ok: true, ...status };
  });

  ipcMain.handle("satellite:send-to-mirage", async () => {
    const status = await getEchoSurveyPairingStatus();
    const bundle = buildMiragePairingBundle(status);
    if (!bundle.ok) {
      return bundle;
    }
    clipboard.writeText(bundle.clipboardText);
    void pushSurveyRelayBundle(status);
    const push = pairServer?.surveyTeamHub.pushPairingBundle({
      host: bundle.host,
      port: bundle.port,
      pin: bundle.pin,
      mirageUrl: bundle.mirageUrl,
      echoNodeId: status.echoNodeId ?? null,
      sessionEpoch: status.sessionEpoch ?? null,
    });
    const delivered = push?.delivered ?? 0;
    return {
      ok: true,
      message:
        delivered > 0
          ? `Copied + pushed to ${delivered} Mirage desktop(s). Paste if needed.`
          : bundle.message,
      mirageUrl: bundle.mirageUrl,
      host: bundle.host,
      port: bundle.port,
      pin: bundle.pin,
      pushedToMirage: delivered,
    };
  });

  ipcMain.handle("satellite:pair-from-url", async (_event, capturePairUrl) => {
    try {
      const nodeId = await getOrCreateNodeId(app);
      const params = parseCapturePairUrl(capturePairUrl, nodeId);
      const result = await completeCapturePair(params);
      if (!result.ok || !result.credentials) {
        return { ok: false, reason: result.reason ?? "Pair failed" };
      }
      await armWithCredentials(result.credentials, true);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Pair failed",
      };
    }
  });

  ipcMain.handle("satellite:test-capture", async () => {
    try {
      const capture = await capturePrimaryMonitorPng();
      return {
        ok: true,
        width: capture.width,
        height: capture.height,
        pngBytes: capture.pngBase64.length,
        pngBase64: capture.pngBase64,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Capture failed",
      };
    }
  });

  ipcMain.handle("satellite:disarm", async () => {
    armed = false;
    stopWs();
    cachedCredentials = null;
    await clearCredentials(app);
    trayManager.showMainWindow();
    return statusSnapshot();
  });

  ipcMain.handle("satellite:hide-to-tray", () => {
    trayManager.hideMainWindow();
  });

  ipcMain.handle("satellite:check-permissions", () => {
    if (process.platform === "darwin") {
      const granted = systemPreferences.getMediaAccessStatus("screen") === "granted";
      return {
        platform: "macos",
        screenRecording: granted,
        hint: granted
          ? null
          : "Grant Screen Recording in System Settings → Privacy & Security.",
      };
    }
    return { platform: process.platform, screenRecording: true, hint: null };
  });

  ipcMain.handle("satellite:open-screen-settings", async () => {
    if (process.platform === "darwin") {
      await shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
      );
    }
  });

  ipcMain.handle("satellite:get-diagnostics", () =>
    logger.getDiagnostics(version, process.platform, trayManager.isTrayReady() ? "tray" : "window"),
  );

  ipcMain.handle("satellite:check-for-updates", async () => checkForSatelliteUpdate(version));

  ipcMain.handle("satellite:download-and-install-update", async (_event, input) => {
    try {
      if (!input?.downloadUrl || !input?.fileName) {
        return { ok: false, reason: "Update download info missing." };
      }
      const result = await downloadAndInstallSatelliteUpdate(input);
      if (result.quitApp) {
        setTimeout(() => {
          app.quit();
        }, 600);
      }
      return result;
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Update install failed.",
      };
    }
  });
}

app.whenReady().then(async () => {
  logger.beginSession(app, version);
  logger.step(1, 8, "electron main starting");
  registerIpc();
  createMainWindow();
  logger.step(2, 8, "browser window created");
  await initializeAfterReady();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopWs();
  pairServer?.server?.close();
});
