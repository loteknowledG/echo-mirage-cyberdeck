const path = require('path');
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');

let playrightBrowserState = null;

async function ensurePlaywrightBrowserState() {
  if (playrightBrowserState) {
    return playrightBrowserState;
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('about:blank');

  playrightBrowserState = { browser, context, page };
  return playrightBrowserState;
}

async function snapshotPage(page) {
  const [title, url, text] = await Promise.all([
    page.title().catch(() => ''),
    Promise.resolve(page.url()),
    page
      .evaluate(() => {
        try {
          return document && document.body
            ? String(document.body.innerText || document.body.textContent || '')
            : '';
        } catch {
          return '';
        }
      })
      .catch(() => ''),
  ]);

  return {
    ok: true,
    url: String(url || ''),
    title: String(title || ''),
    text: String(text || ''),
  };
}

async function navigatePlaywrightBrowser(url) {
  const { page } = await ensurePlaywrightBrowserState();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return snapshotPage(page);
}

async function snapshotPlaywrightBrowser() {
  const { page } = await ensurePlaywrightBrowserState();
  return snapshotPage(page);
}

async function reloadPlaywrightBrowser() {
  const { page } = await ensurePlaywrightBrowserState();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  return snapshotPage(page);
}

async function goBackPlaywrightBrowser() {
  const { page } = await ensurePlaywrightBrowserState();
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  return snapshotPage(page);
}

async function goForwardPlaywrightBrowser() {
  const { page } = await ensurePlaywrightBrowserState();
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  return snapshotPage(page);
}

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
      webviewTag: true,
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

ipcMain.handle('echo-mirage-browser:navigate', async (_event, url) => {
  try {
    return await navigatePlaywrightBrowser(String(url || 'about:blank'));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser navigate failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:snapshot', async () => {
  try {
    return await snapshotPlaywrightBrowser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser snapshot failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:reload', async () => {
  try {
    return await reloadPlaywrightBrowser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser reload failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:back', async () => {
  try {
    return await goBackPlaywrightBrowser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser back failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:forward', async () => {
  try {
    return await goForwardPlaywrightBrowser();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser forward failed.' };
  }
});

app.whenReady().then(createWindow);

app.on('before-quit', async () => {
  if (playrightBrowserState?.browser) {
    try {
      await playrightBrowserState.browser.close();
    } catch {
      /* ignore */
    } finally {
      playrightBrowserState = null;
    }
  }
});

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
