const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_FEED_URL =
  'https://github.com/loteknowledG/echo-mirage-cyberdeck/releases/latest/download';

/** @type {string | null} */
let downloadedVersion = null;

function broadcastUpdateEvent(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send('echo:app-update:event', payload);
  }
}

function compareVersions(left, right) {
  const a = String(left || '0.0.0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || '0.0.0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function formatCheckResult(latestVersion, downloaded) {
  const running = app.getVersion();
  const latest = latestVersion || running;
  if (downloaded || compareVersions(latest, running) > 0) {
    return { status: 'update-available', running, latest, downloaded: Boolean(downloaded) };
  }
  return { status: 'up-to-date', running, latest: running, downloaded: false };
}

function registerDevAutoUpdateHandlers() {
  ipcMain.handle('echo:app-update:get-version', async () => app.getVersion());

  ipcMain.handle('echo:app-update:check', async () => ({
    status: 'local-dev',
    message: 'Auto-update runs in installed desktop builds. Dev mode uses pnpm electron:dev.',
  }));

  ipcMain.handle('echo:app-update:quit-and-install', async () => ({
    ok: false,
    error: 'No downloaded update is ready to install in dev mode.',
  }));
}

function initializeAutoUpdater() {
  if (!app.isPackaged) {
    registerDevAutoUpdateHandlers();
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
  });

  autoUpdater.on('update-available', (info) => {
    broadcastUpdateEvent({ type: 'update-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdateEvent({
      type: 'download-progress',
      percent: progress.percent,
      version: downloadedVersion,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloadedVersion = info.version;
    broadcastUpdateEvent({ type: 'update-downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    broadcastUpdateEvent({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  });

  ipcMain.handle('echo:app-update:get-version', async () => app.getVersion());

  ipcMain.handle('echo:app-update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const latest = result?.updateInfo?.version ?? app.getVersion();
      return formatCheckResult(latest, downloadedVersion === latest);
    } catch (error) {
      return {
        status: 'unavailable',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('echo:app-update:quit-and-install', async () => {
    if (downloadedVersion) {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    }
    return { ok: false, error: 'No downloaded update is ready to install.' };
  });

  const runBackgroundCheck = () => {
    void autoUpdater.checkForUpdates().catch(() => {
      /* surfaced via update:error event */
    });
  };

  setTimeout(runBackgroundCheck, 12_000);
  setInterval(runBackgroundCheck, 4 * 60 * 60 * 1000);
}

module.exports = {
  initializeAutoUpdater,
};
