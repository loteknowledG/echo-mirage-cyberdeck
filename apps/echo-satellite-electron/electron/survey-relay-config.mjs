import fs from "node:fs/promises";
import path from "node:path";

/**
 * Persist Survey cloud-relay auth in Echo userData so double-clicked .app
 * can authenticate to Vercel without Terminal env vars.
 *
 * @param {import('electron').App} app
 */
export function surveyRelayEnvPath(app) {
  return path.join(app.getPath("userData"), "survey-relay.env");
}

/**
 * @param {string} raw
 */
function parseEnvFile(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load relay secret into process.env (env wins over file).
 * @param {import('electron').App} app
 */
export async function applySurveyRelayEnvFromDisk(app) {
  try {
    const raw = await fs.readFile(surveyRelayEnvPath(app), "utf8");
    const parsed = parseEnvFile(raw);
    if (!process.env.SURVEY_RELAY_SECRET?.trim() && parsed.SURVEY_RELAY_SECRET?.trim()) {
      process.env.SURVEY_RELAY_SECRET = parsed.SURVEY_RELAY_SECRET.trim();
    }
    if (!process.env.SURVEY_RELAY_BASE_URL?.trim() && parsed.SURVEY_RELAY_BASE_URL?.trim()) {
      process.env.SURVEY_RELAY_BASE_URL = parsed.SURVEY_RELAY_BASE_URL.trim();
    }
  } catch {
    /* missing file is fine */
  }
}

/**
 * @param {import('electron').App} app
 */
export async function loadSurveyRelaySecret(app) {
  await applySurveyRelayEnvFromDisk(app);
  return process.env.SURVEY_RELAY_SECRET?.trim() || "";
}

/**
 * @param {import('electron').App} app
 * @param {string} secret
 */
export async function saveSurveyRelaySecret(app, secret) {
  const trimmed = secret.trim();
  const filePath = surveyRelayEnvPath(app);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (!trimmed) {
    try {
      await fs.unlink(filePath);
    } catch {
      /* ignore */
    }
    delete process.env.SURVEY_RELAY_SECRET;
    return { ok: true, configured: false };
  }
  await fs.writeFile(filePath, `SURVEY_RELAY_SECRET=${trimmed}\n`, "utf8");
  process.env.SURVEY_RELAY_SECRET = trimmed;
  return { ok: true, configured: true };
}

export function surveyRelaySecretConfigured() {
  return Boolean(process.env.SURVEY_RELAY_SECRET?.trim());
}
