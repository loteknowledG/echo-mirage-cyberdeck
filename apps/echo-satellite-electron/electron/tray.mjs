/**
 * @param {{ app: import('electron').App, Tray: typeof import('electron').Tray, Menu: typeof import('electron').Menu, nativeImage: import('electron').NativeImage | null }} deps
 */
export function createTrayManager(deps) {
  const { app, Tray, Menu, nativeImage } = deps;
  /** @type {import('electron').Tray | null} */
  let tray = null;
  /** @type {import('electron').BrowserWindow | null} */
  let mainWindow = null;
  let trayReady = false;
  let quitting = false;

  function buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: "Show setup",
        click: () => showMainWindow(),
      },
      {
        label: "Disarm",
        click: () => {
          mainWindow?.webContents.send("satellite:disarm");
        },
      },
      { type: "separator" },
      {
        label: "Quit Echo Satellite (echo-electron)",
        click: () => quitApp(),
      },
    ]);
  }

  function resolveIcon() {
    if (!nativeImage) return null;
    const image = nativeImage.resize({ width: 16, height: 16 });
    return image;
  }

  function ensureTray() {
    if (process.platform === "darwin") {
      trayReady = false;
      return;
    }
    if (tray) {
      trayReady = true;
      return;
    }
    const icon = resolveIcon();
    if (!icon) return;
    tray = new Tray(icon);
    tray.setToolTip("Echo Satellite (echo-electron)");
    tray.setContextMenu(buildMenu());
    tray.on("click", () => showMainWindow());
    trayReady = true;
  }

  /** @param {import('electron').BrowserWindow} window */
  function attachWindow(window) {
    mainWindow = window;
    window.on("close", (event) => {
      if (quitting) return;
      if (!trayReady) return;
      event.preventDefault();
      window.hide();
    });
  }

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
  }

  function hideMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.hide();
  }

  function quitApp() {
    quitting = true;
    app.quit();
  }

  function isTrayReady() {
    return trayReady;
  }

  return {
    attachWindow,
    ensureTray,
    showMainWindow,
    hideMainWindow,
    quitApp,
    isTrayReady,
  };
}
