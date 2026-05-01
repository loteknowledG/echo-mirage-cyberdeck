const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');

function dispatchRendererAction(win, action) {
  const payload = JSON.stringify(String(action || ''));
  void win.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent("echo-mirage-context-action", { detail: ${payload} }))`
  ).catch(() => {});
}

function buildContextMenu(win, params) {
  const template = [];

  const pageURL = String(params.pageURL || win.webContents.getURL() || '');
  const isCyberdeck = pageURL.includes('/cyberdeck');

  if (params.selectionText && params.selectionText.trim()) {
    template.push({
      label: `Search Google for "${params.selectionText.slice(0, 40)}${params.selectionText.length > 40 ? '…' : ''}"`,
      click: () => {
        const query = encodeURIComponent(params.selectionText);
        void shell.openExternal(`https://www.google.com/search?q=${query}`);
      },
    });
    template.push({ role: 'copy' });
    template.push({ role: 'selectAll' });
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
    return;
  }

  if (isCyberdeck) {
    template.push({
      label: 'Save Document...',
      click: () => dispatchRendererAction(win, 'save-operator'),
    });
    template.push({
      label: 'Paste',
      click: () => dispatchRendererAction(win, 'paste-operator'),
    });
    template.push({
      label: 'Copy Document',
      click: () => dispatchRendererAction(win, 'copy-operator'),
    });
    template.push({ type: 'separator' });
  }

  template.push({ role: 'back', enabled: win.webContents.canGoBack() });
  template.push({ role: 'forward', enabled: win.webContents.canGoForward() });
  template.push({ type: 'separator' });
  template.push({ role: 'reload' });
  template.push({ role: 'forceReload' });
  template.push({ type: 'separator' });
  template.push({ role: 'cut', enabled: params.isEditable });
  template.push({ role: 'copy', enabled: Boolean(params.selectionText) || params.isEditable });
  template.push({ role: 'paste', enabled: params.isEditable });
  template.push({ role: 'selectAll' });
  template.push({ type: 'separator' });
  template.push({ role: 'toggleDevTools' });

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: win });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.on('context-menu', (_event, params) => {
    buildContextMenu(win, params);
  });

  // Load your Next.js app (dev server)
  // Keep in sync with package.json dev/start port (avoids clash with Weyland-Yutani on :3000).
  win.loadURL('http://127.0.0.1:3050/cyberdeck');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
