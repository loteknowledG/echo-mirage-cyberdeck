const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, shell, ipcMain, clipboard, dialog, protocol, net, nativeImage, Tray } = require('electron');
const { pathToFileURL } = require('url');
const {
  initializeMediaProtection,
  getMediaProtectionStatus,
  setMediaProtectionEnabled,
  setMediaProtectionMainWindow,
} = require('./media-protection');
const {
  initializeSilentMode,
  loadSilentModeState,
  getSilentMode,
  ensureTray,
  destroyTray,
  showMainWindow,
  hideMainWindowToTray,
  applySilentModeWindowState,
  shouldPreventWindowClose,
  setMainWindow,
  registerSilentModeIpc,
} = require('./silent-mode');
const {
  startPackagedNextServer,
  stopPackagedNextServer,
} = require('./packaged-server');
const { initializeAutoUpdater } = require('./auto-updater');

initializeSilentMode({ app, Tray, Menu, nativeImage });

const DESKTOP_PROTOCOL = 'echomirage';
/** @type {string | null} */
let pendingProtocolPath = null;

function registerDesktopProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
  }
}

function parseProtocolLaunchPath(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(`${DESKTOP_PROTOCOL}://`)) return null;
  try {
    const parsed = new URL(rawUrl);
    const deepPath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/cyberdeck';
    return `${deepPath}${parsed.search || ''}`;
  } catch {
    return '/cyberdeck';
  }
}

function findProtocolLaunchArg(argv = process.argv) {
  return argv.find((arg) => arg.startsWith(`${DESKTOP_PROTOCOL}://`)) ?? null;
}

async function navigateMainWindowToPath(deepPath) {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    pendingProtocolPath = deepPath;
    return;
  }
  try {
    const origin = await getDevOrigin();
    await win.loadURL(`${origin}${deepPath}`);
    showMainWindow();
  } catch (error) {
    process.stderr.write(`[echo-mirage] protocol navigation failed: ${error}\n`);
  }
}

function handleProtocolLaunch(rawUrl) {
  const deepPath = parseProtocolLaunchPath(rawUrl);
  if (!deepPath) return;
  void navigateMainWindowToPath(deepPath);
}

registerDesktopProtocolClient();

if (process.platform === 'darwin') {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolLaunch(url);
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const protocolArg = findProtocolLaunchArg(argv);
    if (protocolArg) {
      handleProtocolLaunch(protocolArg);
    } else {
      showMainWindow();
    }
  });
}

if (!app.isPackaged && process.platform === 'win32') {
  // Dev-only: reduce GPU/network subprocess crashes while hot-reloading a heavy page.
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.disableHardwareAcceleration();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'echo-mirage-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

function decodeEchoMirageFileUrl(url) {
  const prefix = 'echo-mirage-file://';
  if (!url.startsWith(prefix)) return null;
  let filePath = decodeURIComponent(url.slice(prefix.length));
  if (process.platform === 'win32' && filePath.startsWith('/')) {
    filePath = filePath.slice(1);
  }
  return path.normalize(filePath);
}

function registerEchoMirageFileProtocol() {
  protocol.handle('echo-mirage-file', (request) => {
    const filePath = decodeEchoMirageFileUrl(request.url);
    if (!filePath) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function getEchoMirageProjectRoot() {
  if (process.env.ECHO_MIRAGE_PROJECT_ROOT) {
    return path.resolve(process.env.ECHO_MIRAGE_PROJECT_ROOT);
  }
  if (!app.isPackaged) {
    return path.resolve(__dirname, '..');
  }
  return app.getPath('documents');
}

async function getDevOrigin() {
  if (process.env.ECHO_MIRAGE_DEV_ORIGIN) {
    return process.env.ECHO_MIRAGE_DEV_ORIGIN;
  }

  if (app.isPackaged) {
    return startPackagedNextServer();
  }

  if (!app.isPackaged) {
    try {
      const statePath = path.resolve(__dirname, '..', '.tmp', 'dev-server.json');
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      if (state?.origin) {
        return String(state.origin);
      }
      if (state?.appPort) {
        return `http://127.0.0.1:${state.appPort}`;
      }
    } catch {
      /* fixed-port dev fallback */
    }
  }

  return 'http://127.0.0.1:3050';
}

const OPERATOR_FOLDER_IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.pnpm-store',
  '.cache',
  '.muthur',
]);

const OPERATOR_FOLDER_LIST_MAX_ENTRIES = 400;

/** Above this size, pass filePath only — do not base64 into the renderer (OOM). */
const OPERATOR_MAX_INLINE_BINARY_BYTES = 8 * 1024 * 1024;

/** Extensions that must never be read as UTF-8 text (L-13). */
const OPERATOR_BINARY_PREVIEW_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.bmp',
  '.ico',
]);

const OPERATOR_BINARY_METADATA_EXTENSIONS = new Set([
  '.doc',
  '.pptx',
  '.ppt',
  '.xlsx',
  '.xls',
]);

/** In-place binary writes from the operator pane (editable previews). */
const OPERATOR_BINARY_SAVE_EXTENSIONS = new Set(['.pdf', '.docx']);

function operatorMimeTypeForFileName(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.env': 'text/plain',
    '.local': 'text/plain',
  };
  if (name === '.env' || name.startsWith('.env.')) return 'text/plain';
  return map[ext] || 'application/octet-stream';
}

function isPathInsideRoot(rootPath, targetPath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveOperatorFolderPath(rootPath, relativePath = '') {
  const root = path.resolve(rootPath);
  const parts = String(relativePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  const target = path.resolve(root, ...parts);
  if (!isPathInsideRoot(root, target)) {
    throw new Error('Path escapes folder root.');
  }
  return target;
}

async function listOperatorFolderEntries(rootPath, relativePath, pathPrefix) {
  const dirPath = resolveOperatorFolderPath(rootPath, relativePath);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    const entryPath = `${pathPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (OPERATOR_FOLDER_IGNORED_NAMES.has(entry.name)) {
        nodes.push({ name: entry.name, path: entryPath, kind: 'folder', ignored: true });
      } else {
        nodes.push({ name: entry.name, path: entryPath, kind: 'folder' });
      }
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: entryPath, kind: 'file' });
    }

    if (nodes.length > OPERATOR_FOLDER_LIST_MAX_ENTRIES) {
      break;
    }
  }

  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (entries.length <= OPERATOR_FOLDER_LIST_MAX_ENTRIES) {
    return nodes;
  }

  const kept = nodes.slice(0, OPERATOR_FOLDER_LIST_MAX_ENTRIES);
  kept.push({
    name: '… more entries',
    path: `${pathPrefix}/__truncated__`,
    kind: 'folder',
    truncated: true,
    ignored: true,
  });
  return kept;
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

async function loadStartupErrorPage(win, message) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Echo Mirage Cyberdeck</title></head><body style="margin:0;background:#000;color:#8fd88f;font-family:Consolas,monospace;padding:24px"><h1 style="font-size:14px;letter-spacing:0.08em">ECHO MIRAGE // STARTUP FAILED</h1><p style="font-size:12px;line-height:1.5;color:#9a9a9a">The embedded cyberdeck server did not start. Try reinstalling from GitHub Releases, or run the latest installer build.</p><pre style="white-space:pre-wrap;font-size:11px;line-height:1.45;color:#c8c8c8;border:1px solid #1f1f1f;padding:12px;background:#050505">${message.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch] || ch)}</pre></body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function createWindow() {
  const startInSilentTray = getSilentMode();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  setMainWindow(win);

  win.on('close', (event) => {
    if (shouldPreventWindowClose()) {
      event.preventDefault();
      hideMainWindowToTray();
    }
  });

  win.webContents.on('context-menu', (_event, params) => {
    buildContextMenu(win, params);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith('data:')) return;
    process.stderr.write(
      `[echo-mirage] did-fail-load code=${errorCode} url=${validatedURL} ${errorDescription}\n`,
    );
  });

  try {
    const origin = await getDevOrigin();
    const protocolArg = findProtocolLaunchArg();
    if (protocolArg && !pendingProtocolPath) {
      pendingProtocolPath = parseProtocolLaunchPath(protocolArg);
    }
    const launchPath = pendingProtocolPath || '/cyberdeck';
    pendingProtocolPath = null;
    await win.loadURL(`${origin}${launchPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[echo-mirage] startup error: ${message}\n`);
    await loadStartupErrorPage(win, message);
    if (app.isPackaged) {
      dialog.showErrorBox('Echo Mirage Cyberdeck', message.slice(0, 2000));
    }
  }

  if (!startInSilentTray) {
    win.show();
    win.focus();
  } else {
    ensureTray();
    applySilentModeWindowState(win, false);
  }

  if (!app.isPackaged && process.env.CYBERDECK_ELECTRON_FORCE_RELOAD === '1') {
    setupDevRendererReload(win);
  }

  setMediaProtectionMainWindow(win);
  return win;
}

function setupDevRendererReload(win) {
  const projectRoot = path.resolve(__dirname, '..');
  const watchRoots = [
    path.join(projectRoot, 'src', 'app', 'preview'),
    path.join(projectRoot, 'src', 'components', 'cyberdeck'),
    path.join(projectRoot, 'src', 'features', 'cyberdeck', 'pane-loaders'),
  ];

  const watchers = [];
  let reloadTimer = null;

  const triggerReload = () => {
    if (win.isDestroyed()) return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.reloadIgnoringCache();
      } catch {
        /* ignore reload failures during dev transitions */
      }
    }, 120);
  };

  for (const watchRoot of watchRoots) {
    if (!fsSync.existsSync(watchRoot)) continue;
    try {
      const watcher = fsSync.watch(
        watchRoot,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return;
          const normalized = String(filename).replace(/\\/g, '/');
          if (normalized.includes('/.next/')) return;
          if (normalized.includes('/node_modules/')) return;
          triggerReload();
        },
      );
      watchers.push(watcher);
    } catch {
      /* best-effort watcher; HMR remains primary path */
    }
  }

  win.on('closed', () => {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
      reloadTimer = null;
    }
    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        /* ignore close errors */
      }
    }
  });
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

ipcMain.handle('echo-mirage-clipboard:read-text', async () => clipboard.readText());

ipcMain.handle('echo-mirage-clipboard:write-text', async (_event, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

ipcMain.handle('echo-mirage-media-protection:status', async () => getMediaProtectionStatus());

ipcMain.handle('echo-mirage-media-protection:set-enabled', async (_event, enabled) => {
  setMediaProtectionEnabled(Boolean(enabled));
  return getMediaProtectionStatus();
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

ipcMain.handle('echo-mirage-open:pick-operator-folder', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      defaultPath: getEchoMirageProjectRoot(),
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }
    const folderPath = path.resolve(result.filePaths[0]);
    return {
      canceled: false,
      folderPath,
      name: path.basename(folderPath) || 'folder',
    };
  } catch (error) {
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Open folder dialog failed',
    };
  }
});

ipcMain.handle('echo-mirage-open:list-operator-folder', async (_event, payload) => {
  try {
    const rootPath = String(payload?.rootPath || '');
    const relativePath = String(payload?.relativePath || '');
    const pathPrefix = String(payload?.pathPrefix || '');
    if (!rootPath || !pathPrefix) {
      return { ok: false, error: 'Missing folder path.' };
    }
    const nodes = await listOperatorFolderEntries(rootPath, relativePath, pathPrefix);
    return { ok: true, nodes };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not list folder.',
    };
  }
});

ipcMain.handle('echo-mirage-open:read-operator-file', async (_event, payload) => {
  try {
    const rootPath = String(payload?.rootPath || '');
    const logicalPath = String(payload?.logicalPath || '');
    if (!rootPath || !logicalPath) {
      return { ok: false, error: 'Missing file path.' };
    }
    const parts = logicalPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(1);
    if (parts.length === 0) {
      return { ok: false, error: 'Invalid file path.' };
    }
    for (const part of parts.slice(0, -1)) {
      if (OPERATOR_FOLDER_IGNORED_NAMES.has(part)) {
        return { ok: false, error: 'Folder is not browsable.' };
      }
    }
    const filePath = resolveOperatorFolderPath(rootPath, parts.join('/'));
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { ok: false, error: 'Not a file.' };
    }
    const name = path.basename(filePath);
    const ext = path.extname(name).toLowerCase();
    const mimeType = operatorMimeTypeForFileName(name);

    if (OPERATOR_BINARY_PREVIEW_EXTENSIONS.has(ext)) {
      if (stat.size > OPERATOR_MAX_INLINE_BINARY_BYTES) {
        return {
          ok: true,
          name,
          mimeType,
          filePath,
          size: stat.size,
          largeBinary: true,
        };
      }
      const buffer = await fs.readFile(filePath);
      return {
        ok: true,
        name,
        mimeType,
        base64: buffer.toString('base64'),
        filePath,
        size: stat.size,
      };
    }

    if (OPERATOR_BINARY_METADATA_EXTENSIONS.has(ext)) {
      return {
        ok: true,
        name,
        mimeType,
        size: stat.size,
        binaryMetadata: true,
      };
    }

    const text = await fs.readFile(filePath, 'utf8');
    return {
      ok: true,
      name,
      mimeType: mimeType.startsWith('text/') || mimeType === 'application/json' ? mimeType : 'text/plain',
      text,
      size: stat.size,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not read file.',
    };
  }
});

ipcMain.handle('echo-mirage-open:open-path', async (_event, payload) => {
  try {
    const filePath = String(payload?.filePath || '');
    if (!filePath) {
      return { ok: false, error: 'Missing file path.' };
    }
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) {
      return { ok: false, error: errorMessage };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not open file.',
    };
  }
});

ipcMain.handle('echo-mirage-open:write-operator-file', async (_event, payload) => {
  try {
    const rootPath = String(payload?.rootPath || '');
    const logicalPath = String(payload?.logicalPath || '');
    const content = String(payload?.content ?? '');
    if (!rootPath || !logicalPath) {
      return { ok: false, error: 'Missing file path.' };
    }
    const parts = logicalPath.replace(/\\/g, '/').split('/').filter(Boolean).slice(1);
    if (parts.length === 0) {
      return { ok: false, error: 'Invalid file path.' };
    }
    for (const part of parts.slice(0, -1)) {
      if (OPERATOR_FOLDER_IGNORED_NAMES.has(part)) {
        return { ok: false, error: 'Folder is not browsable.' };
      }
    }
    const filePath = resolveOperatorFolderPath(rootPath, parts.join('/'));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true, filePath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save file.',
    };
  }
});

ipcMain.handle('echo-mirage-open:write-binary-file', async (_event, payload) => {
  try {
    const requestedPath = String(payload?.filePath || '');
    const filePath = requestedPath ? path.resolve(requestedPath) : '';
    const base64 = String(payload?.base64 || '');
    if (!filePath || !base64) {
      return { ok: false, error: 'Missing file path or content.' };
    }
    if (!OPERATOR_BINARY_SAVE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      return {
        ok: false,
        error: 'Binary operator save supports PDF and DOCX files only.',
      };
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
    return { ok: true, filePath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save binary file.',
    };
  }
});

function sanitizeGifDragFileName(name) {
  const trimmed = String(name || '').trim() || 'export.gif';
  const base = path.basename(trimmed).replace(/[^\w.\-()+\s]/g, '_');
  return /\.gif$/i.test(base) ? base : `${base}.gif`;
}

ipcMain.handle('echo-mirage-open:stage-gif-drag', async (_event, payload) => {
  try {
    const base64 = String(payload?.base64 || '');
    if (!base64) {
      return { ok: false, error: 'Missing GIF content.' };
    }
    const fileName = sanitizeGifDragFileName(payload?.fileName);
    const filePath = path.join(app.getPath('temp'), `echo-mirage-drag-${Date.now()}-${fileName}`);
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
    return { ok: true, filePath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not stage GIF for drag.',
    };
  }
});

ipcMain.on('echo-mirage-open:start-file-drag', (event, payload) => {
  try {
    const filePath = path.resolve(String(payload?.filePath || ''));
    if (!filePath || !fsSync.existsSync(filePath)) {
      return;
    }
    const icon = nativeImage.createFromPath(filePath);
    event.sender.startDrag({
      file: filePath,
      icon: icon.isEmpty() ? nativeImage.createEmpty() : icon,
    });
  } catch {
    // Ignore drag failures — renderer falls back to HTML5 drag when possible.
  }
});

ipcMain.handle('echo-mirage-save:show-binary-dialog', async (_event, options) => {
  try {
    const base64 = String(options?.base64 || '');
    if (!base64) {
      return { canceled: true, error: 'No file content to save.' };
    }
    const projectRoot = getEchoMirageProjectRoot();
    const relative = String(options?.defaultRelativePath || 'docs/cadre/export.bin').replace(/\\/g, '/');
    const defaultPath = options?.defaultPath
      ? path.resolve(String(options.defaultPath))
      : path.join(projectRoot, ...relative.split('/').filter(Boolean));
    const ext = path.extname(defaultPath).replace(/^\./, '') || 'pdf';
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [
        { name: ext.toUpperCase(), extensions: [ext] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    await fs.mkdir(path.dirname(result.filePath), { recursive: true });
    await fs.writeFile(result.filePath, Buffer.from(base64, 'base64'));
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Save dialog failed',
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
        { name: 'All files', extensions: ['*'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'Environment', extensions: ['local', 'env'] },
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

app.whenReady().then(async () => {
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }
  registerEchoMirageFileProtocol();
  await initializeMediaProtection();
  await loadSilentModeState();
  registerSilentModeIpc(ipcMain);
  initializeAutoUpdater();
  if (getSilentMode()) {
    ensureTray();
  }
  return createWindow();
});

app.on('before-quit', async () => {
  destroyTray();
  stopPackagedNextServer();
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
  if (getSilentMode()) {
    return;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
    return;
  }
  showMainWindow();
});
