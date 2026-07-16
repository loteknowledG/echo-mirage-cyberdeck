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
  'CURSOR_API_KEY',
  'SURVEY_CURSOR_API_KEY',
];

/**
 * Parse a KEY=VALUE env file. Only allowlisted provider keys are kept.
 * @param {string} envPath
 * @returns {Record<string, string>}
 */
function parseProviderEnvFile(envPath) {
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
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!DESKTOP_PROVIDER_ENV_KEYS.includes(key) || !value) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Merge provider env from several locations (later files override earlier).
 * Typical order: installer bundle → userData override → project .env.local (dev).
 * @param {string[]} envPaths
 * @returns {Record<string, string>}
 */
function loadDesktopProviderEnvFromPaths(envPaths) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const envPath of envPaths) {
    if (!envPath) continue;
    Object.assign(out, parseProviderEnvFile(envPath));
  }
  return out;
}

/**
 * @param {string} appDir standalone app directory (resources/app)
 * @param {{ userDataDir?: string, projectRoot?: string }} [options]
 * @returns {Record<string, string>}
 */
function loadDesktopProviderEnv(appDir, options = {}) {
  const paths = [
    path.join(appDir, 'desktop-provider.env'),
    options.userDataDir
      ? path.join(options.userDataDir, 'desktop-provider.env')
      : '',
    options.projectRoot ? path.join(options.projectRoot, '.env.local') : '',
    options.projectRoot ? path.join(options.projectRoot, '.env') : '',
  ].filter(Boolean);

  return loadDesktopProviderEnvFromPaths(paths);
}

/**
 * Persist provider keys for the next desktop launch (userData, not Program Files).
 * @param {string} userDataDir
 * @param {Record<string, string>} vars
 */
function writeDesktopProviderEnv(userDataDir, vars) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const envPath = path.join(userDataDir, 'desktop-provider.env');
  const existing = parseProviderEnvFile(envPath);
  const merged = { ...existing };
  for (const [key, value] of Object.entries(vars)) {
    if (!DESKTOP_PROVIDER_ENV_KEYS.includes(key)) continue;
    const trimmed = String(value || '').trim();
    if (trimmed) merged[key] = trimmed;
  }
  const lines = [
    '# Echo Mirage desktop provider env — local only, do not commit.',
    ...Object.entries(merged).map(([key, value]) => `${key}=${value}`),
    '',
  ];
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  return envPath;
}

module.exports = {
  DESKTOP_PROVIDER_ENV_KEYS,
  loadDesktopProviderEnv,
  loadDesktopProviderEnvFromPaths,
  parseProviderEnvFile,
  writeDesktopProviderEnv,
};
