const fs = require('fs');
const path = require('path');

/** Keys injected into packaged desktop Next.js server (see write-desktop-provider-env.mjs). */
const DESKTOP_PROVIDER_ENV_KEYS = [
  'OPENCODE_ZEN_API_KEY',
  'OPENCODE_API_KEY',
  'ZEN_API_KEY',
  'OPENCODE_GO_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
];

/**
 * Parse desktop-provider.env from the standalone bundle (non-dotfile for electron-builder).
 * @param {string} appDir
 * @returns {Record<string, string>}
 */
function loadDesktopProviderEnv(appDir) {
  const envPath = path.join(appDir, 'desktop-provider.env');
  if (!fs.existsSync(envPath)) return {};

  /** @type {Record<string, string>} */
  const out = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!DESKTOP_PROVIDER_ENV_KEYS.includes(key) || !value) continue;
    out[key] = value;
  }
  return out;
}

module.exports = {
  loadDesktopProviderEnv,
};
