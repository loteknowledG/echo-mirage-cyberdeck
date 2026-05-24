const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow, Menu, shell, ipcMain, clipboard, dialog } = require('electron');

function getEchoMirageProjectRoot() {
  if (process.env.ECHO_MIRAGE_PROJECT_ROOT) {
    return path.resolve(process.env.ECHO_MIRAGE_PROJECT_ROOT);
  }
  if (!app.isPackaged) {
    return path.resolve(__dirname, '..');
  }
  return app.getPath('documents');
}

let playrightBrowserState = null;

async function ensurePlaywrightBrowserState() {
  if (playrightBrowserState) {
    return playrightBrowserState;
  }

  const { chromium } = require('playwright');
  const userDataDir = path.join(app.getPath('userData'), 'playwright-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const browser = context.browser();
  const existingPages = context.pages();
  const page = existingPages.length > 0 ? existingPages[0] : await context.newPage();
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

async function runBrowserScript(page, script) {
  const result = await page.evaluate((code) => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${code});`);
      return fn();
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Script execution failed.' };
    }
  }, script);

  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'Browser script returned no result.' };
  }

  return result;
}

async function clickPlaywrightBrowser(selector) {
  const { page } = await ensurePlaywrightBrowserState();
  const escaped = JSON.stringify(String(selector || '').trim());
  const result = await runBrowserScript(page, `
    (() => {
      const selector = ${escaped};
      const el = document.querySelector(selector);
      if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
      if (typeof el.click === 'function') el.click();
      return { ok: true };
    })
  `);
  if (!result.ok) {
    throw new Error(result.error || 'Browser click failed.');
  }
  return snapshotPage(page);
}

async function typePlaywrightBrowser(selector, value) {
  const { page } = await ensurePlaywrightBrowserState();
  const escapedSelector = JSON.stringify(String(selector || '').trim());
  const escapedValue = JSON.stringify(String(value || ''));
  const result = await runBrowserScript(page, `
    (() => {
      const selector = ${escapedSelector};
      const value = ${escapedValue};
      const el = document.querySelector(selector);
      if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
      const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (isInput) {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) descriptor.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      }
      if (el.isContentEditable) {
        el.focus();
        el.innerText = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return { ok: true };
      }
      return { ok: false, error: \`Selector is not editable: \${selector}\` };
    })
  `);
  if (!result.ok) {
    throw new Error(result.error || 'Browser type failed.');
  }
  return snapshotPage(page);
}

async function submitPlaywrightBrowser(selector) {
  const { page } = await ensurePlaywrightBrowserState();
  const escaped = JSON.stringify(String(selector || '').trim());
  const result = await runBrowserScript(page, `
    (() => {
      const selector = ${escaped};
      const el = document.querySelector(selector);
      if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
      const form = el.tagName === 'FORM' ? el : el.closest('form');
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else if (typeof form.submit === 'function') {
          form.submit();
        }
        return { ok: true };
      }
      if (typeof el.click === 'function') {
        el.click();
        return { ok: true };
      }
      return { ok: false, error: \`Selector has no form or click handler: \${selector}\` };
    })
  `);
  if (!result.ok) {
    throw new Error(result.error || 'Browser submit failed.');
  }
  return snapshotPage(page);
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

ipcMain.handle('echo-mirage-browser:click', async (_event, selector) => {
  try {
    return await clickPlaywrightBrowser(String(selector || ''));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser click failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:type', async (_event, selector, value) => {
  try {
    return await typePlaywrightBrowser(String(selector || ''), String(value || ''));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser type failed.' };
  }
});

ipcMain.handle('echo-mirage-browser:submit', async (_event, selector) => {
  try {
    return await submitPlaywrightBrowser(String(selector || ''));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Browser submit failed.' };
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

ipcMain.handle('echo-mirage-open:pick-convert-document', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'PDF or Word', extensions: ['pdf', 'docx'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx'] },
      ],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  } catch (error) {
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Open document dialog failed',
    };
  }
});

ipcMain.handle('echo-mirage-save:show-dialog', async (_event, options) => {
  try {
    const relative = String(options?.defaultRelativePath || 'docs/cadre/operator-doc.md').replace(/\\/g, '/');
    const content = String(options?.content || '');
    const projectRoot = getEchoMirageProjectRoot();
    const defaultPath = path.join(projectRoot, ...relative.split('/').filter(Boolean));
    await fs.mkdir(path.dirname(defaultPath), { recursive: true });
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    await fs.mkdir(path.dirname(result.filePath), { recursive: true });
    await fs.writeFile(result.filePath, content, 'utf8');
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Save dialog failed',
    };
  }
});

// Computer Use Layer IPC handlers
const MAX_PASTE_LENGTH = 50000;
const ALLOWED_HOTKEYS = new Set(['Ctrl+V', 'Control+V', 'Ctrl+C', 'Control+C', 'Ctrl+A', 'Control+A', 'Enter', 'Escape', 'Esc']);

ipcMain.handle('computer-use:run-action', async (_event, action) => {
  const start = Date.now();
  const actionObj = action && typeof action === 'object' && 'name' in action ? action : null;
  const actionName = actionObj?.name || 'unknown';

  if (!actionObj) {
    return {
      success: false,
      action: actionName,
      status: 'error',
      error: 'INVALID_ACTION: action must be an object with a name property',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  switch (actionName) {
    case 'get_active_window': {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          data: null,
          error: 'NO_FOCUSED_WINDOW: No focused Electron window',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      const title = win.getTitle();
      const url = win.webContents.getURL();
      return {
        success: true,
        action: actionName,
        status: 'completed',
        data: { title, url, isFocused: true },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }

    case 'list_open_windows': {
      const windows = BrowserWindow.getAllWindows();
      const windowInfos = windows.map((win) => ({
        title: win.getTitle(),
        url: win.webContents.getURL(),
        isFocused: win.isFocused(),
      }));
      return {
        success: true,
        action: actionName,
        status: 'completed',
        data: windowInfos,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }

    case 'capture_screen': {
      return {
        success: false,
        action: actionName,
        status: 'error',
        data: null,
        error: 'CAPTURE_NOT_IMPLEMENTED: Screen capture requires desktopCapturer which is not enabled in this build',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }

    case 'paste_text': {
      const text = actionObj.params?.text;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: 'PASTE_REJECTED: Empty text payload',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      if (text.length > MAX_PASTE_LENGTH) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: `PASTE_REJECTED: Payload exceeds max length of ${MAX_PASTE_LENGTH}`,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      if (!actionObj.confirm) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: 'PASTE_REJECTED: Action requires explicit confirmation flag',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      try {
        clipboard.writeText(text);
        return {
          success: true,
          action: actionName,
          status: 'completed',
          data: { written: text.length },
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      } catch (error) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Clipboard write failed',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
    }

    case 'hotkey': {
      const keys = actionObj.params?.keys;
      if (!keys || typeof keys !== 'string') {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: 'HOTKEY_REJECTED: keys parameter required',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      if (!ALLOWED_HOTKEYS.has(keys)) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: `HOTKEY_REJECTED: "${keys}" is not in the allowlist. Allowed: ${[...ALLOWED_HOTKEYS].join(', ')}`,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      if (!actionObj.confirm) {
        return {
          success: false,
          action: actionName,
          status: 'error',
          error: 'HOTKEY_REJECTED: Action requires explicit confirmation flag',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - start,
        };
      }
      return {
        success: false,
        action: actionName,
        status: 'error',
        data: null,
        error: 'HOTKEY_NOT_IMPLEMENTED: Direct hotkey injection requires webContents.send with accelerator which is not implemented',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    }

    case 'stop_execution':
      return {
        success: true,
        action: actionName,
        status: 'stopped',
        data: { stopped: true },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };

    default:
      return {
        success: false,
        action: actionName,
        status: 'error',
        error: `UNKNOWN_ACTION: "${actionName}" is not a recognized computer use action`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
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
