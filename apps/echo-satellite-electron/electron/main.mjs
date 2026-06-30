import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
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
import { startPairServer } from "./pair-server.mjs";
import { createSpyPairing } from "./spy-pairing.mjs";
import { startWsClient } from "./ws-client.mjs";
import { createTrayManager } from "./tray.mjs";
import { checkScreenRecordingAccess, warmElectronScreenCapture } from "./screen-permission.mjs";
import * as logger from "./logger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const version = app.getVersion();

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof startWsClient> | null} */
let wsClient = null;

let armed = false;
/** @type {"disconnected"|"connecting"|"connected"|"error"} */
let wsStatus = "disconnected";
let missionsHandled = 0;
/** @type {string | null} */
let lastError = null;
/** @type {string | null} */
let lastMissionId = null;

/** @type {import('http').Server | null} */
let pairServer = null;

let trayIcon = null;
try {
  const iconPath = path.join(__dirname, "..", "public", "icon.ico");
  trayIcon = nativeImage.createFromPath(iconPath);
} catch {
  trayIcon = null;
}

const trayManager = createTrayManager({ app, Tray, Menu, nativeImage: trayIcon });

/** @type {ReturnType<typeof createSpyPairing> | null} */
let spyPairing = null;

function notifySpyCodesChanged() {
  mainWindow?.webContents.send("satellite:spy-codes-changed");
}

function statusSnapshot() {
  const stats = wsClient?.getStats();
  return {
    armed,
    wsStatus,
    pairHttpPort: DEFAULT_PAIR_HTTP_PORT,
    lastError: stats?.lastError ?? lastError,
    lastMissionId: stats?.lastMissionId ?? lastMissionId,
    missionsHandled: stats?.missionsHandled ?? missionsHandled,
  };
}

function stopWs() {
  wsClient?.stop();
  wsClient = null;
  wsStatus = "disconnected";
}

async function armWithCredentials(creds, hideWindow) {
  await saveCredentials(app, creds);
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
    height: 720,
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

async function initializeAfterReady() {
  logger.step(3, 8, "app ready — starting services");

  spyPairing = createSpyPairing(app, () => getOrCreateNodeId(app));

  pairServer = startPairServer({
    getNodeId: () => getOrCreateNodeId(app),
    onPaired: (creds) => {
      void armWithCredentials(creds, true);
    },
    spyPairing,
    onSpyPaired: () => {
      notifySpyCodesChanged();
    },
  });

  const saved = await loadCredentials(app);
  if (saved) {
    logger.step(6, 8, "restoring saved credentials");
    await armWithCredentials(saved, false);
  } else {
    logger.step(6, 8, "no saved credentials — fresh setup");
  }

  trayManager.ensureTray();
  if (process.platform === "darwin") {
    void warmElectronScreenCapture();
  }
  logger.step(7, 8, process.platform === "darwin" ? "window-only mode (macOS)" : "system tray ready");
}

function registerIpc() {
  ipcMain.handle("satellite:get-status", () => statusSnapshot());

  ipcMain.handle("satellite:get-spy-codes", async () => {
    if (!spyPairing) throw new Error("Spy pairing not ready.");
    const status = await spyPairing.getEchoSpyPairingStatus();
    return { ok: true, ...status };
  });

  ipcMain.handle("satellite:regenerate-spy-codes", async () => {
    if (!spyPairing) throw new Error("Spy pairing not ready.");
    await spyPairing.refreshEchoSpyPairCodes();
    const status = await spyPairing.getEchoSpyPairingStatus();
    notifySpyCodesChanged();
    return { ok: true, ...status };
  });

  ipcMain.handle("satellite:test-capture", async () => {
    try {
      if (process.platform === "darwin") {
        await warmElectronScreenCapture();
      }

      const pngBase64 = await capturePrimaryMonitorPngBase64();
      const dimensions = await capturePrimaryMonitorDimensions();
      const pngBuffer = Buffer.from(pngBase64, "base64");
      const preview = nativeImage.createFromBuffer(pngBuffer).resize({ width: 480 });
      const previewBase64 = preview.toPNG().toString("base64");

      return {
        ok: true,
        width: dimensions?.width,
        height: dimensions?.height,
        pngBytes: pngBase64.length,
        previewDataUrl: `data:image/png;base64,${previewBase64}`,
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
    await clearCredentials(app);
    trayManager.showMainWindow();
    return statusSnapshot();
  });

  ipcMain.handle("satellite:hide-to-tray", () => {
    trayManager.hideMainWindow();
  });

  ipcMain.handle("satellite:check-permissions", async () => {
    if (process.platform === "darwin") {
      const access = await checkScreenRecordingAccess({ probe: true });
      return {
        platform: "macos",
        screenRecording: access.screenRecording,
        hint: access.hint,
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
