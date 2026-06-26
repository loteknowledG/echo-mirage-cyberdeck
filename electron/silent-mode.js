const fs = require('fs/promises');
const path = require('path');

/** @type {boolean} */
let silentModeEnabled = false;
/** @type {import('electron').Tray | null} */
let tray = null;
/** @type {import('electron').BrowserWindow | null} */
let mainWindowRef = null;
/** @type {boolean} */
let isQuitting = false;

/** @type {typeof import('electron') | null} */
let electron = null;
/** @type {string | null} */
let settingsPath = null;

const TRAY_TOOLTIP = 'Echo Mirage';

/** Small 16×16 emerald square PNG for the Windows system tray. */
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVQ4T2P8z8BQz0BFwMjIyMjIwMDAwMDAwP8fQxqGBgYGBgYGBgYGBgAAK0QBR0n7x0kAAAAASUVORK5CYII=';

function getSettingsPath() {
  if (!settingsPath && electron?.app) {
    settingsPath = path.join(electron.app.getPath('userData'), 'echo-mirage-silent-mode.json');
  }
  return settingsPath;
}

async function loadSilentModeState() {
  const filePath = getSettingsPath();
  if (!filePath) return false;
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    silentModeEnabled = parsed?.enabled === true;
  } catch {
    silentModeEnabled = false;
  }
  return silentModeEnabled;
}

async function persistSilentModeState(enabled) {
  const filePath = getSettingsPath();
  if (!filePath) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ enabled: Boolean(enabled) }, null, 2), 'utf8');
}

function getSilentMode() {
  return silentModeEnabled;
}

function notifyRenderer() {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;
  win.webContents.send('echo:silent-mode-changed', { enabled: silentModeEnabled });
}

function resolveTrayIcon() {
  if (!electron?.nativeImage) return null;
  let image = electron.nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  if (process.platform === 'win32') {
    image = image.resize({ width: 16, height: 16 });
  }
  return image;
}

function buildTrayMenu() {
  if (!electron?.Menu) return null;
  const { Menu } = electron;
  return Menu.buildFromTemplate([
    {
      label: 'Open Echo Mirage',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: silentModeEnabled ? 'Disable Silent Mode' : 'Enable Silent Mode',
      click: () => {
        void setSilentMode(!silentModeEnabled);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Echo Mirage',
      click: () => {
        quitApp();
      },
    },
  ]);
}

function refreshTrayMenu() {
  if (!tray) return;
  const menu = buildTrayMenu();
  if (menu) tray.setContextMenu(menu);
}

function ensureTray() {
  if (!electron?.Tray || tray) return tray;
  const icon = resolveTrayIcon();
  if (!icon) return null;
  tray = new electron.Tray(icon);
  tray.setToolTip(TRAY_TOOLTIP);
  tray.on('click', () => {
    showMainWindow();
  });
  refreshTrayMenu();
  return tray;
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function applySilentModeWindowState(win, visible) {
  if (!win || win.isDestroyed()) return;
  if (!silentModeEnabled) {
    win.setSkipTaskbar(false);
    if (visible) {
      if (!win.isVisible()) win.show();
      win.focus();
    }
    return;
  }
  if (visible) {
    win.setSkipTaskbar(false);
    if (!win.isVisible()) win.show();
    win.focus();
    return;
  }
  win.hide();
  win.setSkipTaskbar(true);
}

function showMainWindow() {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;
  applySilentModeWindowState(win, true);
}

function hideMainWindowToTray() {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;
  ensureTray();
  applySilentModeWindowState(win, false);
}

async function setSilentMode(enabled) {
  const next = Boolean(enabled);
  if (next === silentModeEnabled) {
    notifyRenderer();
    return silentModeEnabled;
  }
  silentModeEnabled = next;
  await persistSilentModeState(silentModeEnabled);

  if (silentModeEnabled) {
    ensureTray();
  } else {
    destroyTray();
    const win = mainWindowRef;
    if (win && !win.isDestroyed()) {
      win.setSkipTaskbar(false);
      if (!win.isVisible()) {
        win.show();
        win.focus();
      }
    }
  }

  refreshTrayMenu();
  notifyRenderer();
  return silentModeEnabled;
}

function quitApp() {
  isQuitting = true;
  destroyTray();
  if (electron?.app) {
    electron.app.quit();
  }
}

function shouldPreventWindowClose() {
  return !isQuitting && silentModeEnabled;
}

function isAppQuitting() {
  return isQuitting;
}

function setMainWindow(win) {
  mainWindowRef = win;
}

function registerSilentModeIpc(ipcMain) {
  ipcMain.handle('echo:get-silent-mode', async () => ({ enabled: silentModeEnabled }));
  ipcMain.handle('echo:set-silent-mode', async (_event, enabled) => ({
    enabled: await setSilentMode(Boolean(enabled)),
  }));
}

function initializeSilentMode(deps) {
  electron = deps;
}

module.exports = {
  initializeSilentMode,
  loadSilentModeState,
  getSilentMode,
  setSilentMode,
  ensureTray,
  destroyTray,
  showMainWindow,
  hideMainWindowToTray,
  applySilentModeWindowState,
  shouldPreventWindowClose,
  isAppQuitting,
  setMainWindow,
  registerSilentModeIpc,
  quitApp,
};
