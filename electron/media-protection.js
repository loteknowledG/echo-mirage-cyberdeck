const { session } = require('electron');

/** @typedef {'unavailable' | 'disabled' | 'initializing' | 'enabled' | 'failed'} MediaProtectionStatus */

let status = /** @type {MediaProtectionStatus} */ ('unavailable');
let blockerEngine = null;
let enabled = process.env.ECHO_MIRAGE_MEDIA_PROTECTION !== '0';
/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;

const listeners = new Set();

function setMainWindow(win) {
  mainWindow = win;
}

function setStatus(next) {
  status = next;
  for (const listener of listeners) listener(next);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('echo-mirage-media-protection:status-changed', next);
  }
}

function tryLoadGhostery() {
  try {
    // Optional dependency — playback must not depend on this module loading.
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('@ghostery/adblocker-electron');
  } catch {
    return null;
  }
}

async function installMediaProtectionForSession(ses) {
  if (!blockerEngine || !enabled) return;
  try {
    await blockerEngine.enableBlockingInSession(ses);
  } catch {
    /* non-fatal */
  }
}

async function initializeMediaProtection() {
  if (!enabled) {
    setStatus('disabled');
    return;
  }

  const ghostery = tryLoadGhostery();
  if (!ghostery?.ElectronBlocker) {
    setStatus('unavailable');
    return;
  }

  setStatus('initializing');
  try {
    blockerEngine = await ghostery.ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    await installMediaProtectionForSession(session.defaultSession);
    setStatus('enabled');
  } catch (error) {
    console.warn('[media-protection] Ghostery init failed:', error);
    blockerEngine = null;
    setStatus('failed');
  }
}

function getMediaProtectionStatus() {
  return status;
}

function subscribeMediaProtectionStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setMediaProtectionEnabled(nextEnabled) {
  enabled = Boolean(nextEnabled);
  if (!enabled) {
    setStatus('disabled');
    return;
  }
  void initializeMediaProtection();
}

module.exports = {
  initializeMediaProtection,
  getMediaProtectionStatus,
  subscribeMediaProtectionStatus,
  setMediaProtectionEnabled,
  setMediaProtectionMainWindow: setMainWindow,
};
