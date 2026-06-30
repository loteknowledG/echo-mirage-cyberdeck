import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
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
import { capturePrimaryMonitorDimensions, capturePrimaryMonitorPngBase64 } from "./capture.mjs";
import { parseCapturePairUrl, completeCapturePair } from "./pair.mjs";
import { startPairServer } from "./pair-server.mjs";
import { startWsClient } from "./ws-client.mjs";
import { createTrayManager } from "./tray.mjs";
import * as logger from "./logger.mjs";
import { fetchSpyMirageLinks } from "./spy-links.mjs";
import { checkForSatelliteUpdate, downloadAndInstallSatelliteUpdate } from "./updater.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const version = app.getVersion();

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof startWsClient> | null} */
let wsClient = null;

/** @type {ReturnType<typeof startPairServer> | null} */
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
    spyLinksReachable: cachedSpyLinks.reachable,
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
  return {
    ok: true,
    source: "echo-satellite",
    echoHost: "127.0.0.1",
    httpPort: DEFAULT_PAIR_HTTP_PORT,
    miragePin: null,
    powerfistPin: null,
    mirageExpiresAt: null,
    powerfistExpiresAt: null,
    pairedMirages: snapshot.spyMirages,
    pairedMirage: snapshot.spyMirages[0] ?? null,
    pairedPowerfist: null,
    armed: snapshot.armed,
    wsStatus: snapshot.wsStatus,
    captureMirage: snapshot.captureMirage,
    spyLinksReachable: snapshot.spyLinksReachable,
  };
}

async function refreshSpyLinks() {
  cachedSpyLinks = await fetchSpyMirageLinks();
  mainWindow?.webContents.send("satellite:status-changed", statusSnapshot());
}

async function initializeAfterReady() {
  logger.step(3, 8, "app ready — starting services");

  pairServer = startPairServer({
    getNodeId: () => getOrCreateNodeId(app),
    onPaired: (creds) => {
      void armWithCredentials(creds, true);
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
      const pngBase64 = await capturePrimaryMonitorPngBase64();
      const dimensions = await capturePrimaryMonitorDimensions();
      return {
        ok: true,
        width: dimensions?.width,
        height: dimensions?.height,
        pngBytes: pngBase64.length,
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
  pairServer?.close();
});
