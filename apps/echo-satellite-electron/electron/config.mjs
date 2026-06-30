import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DEFAULT_PAIR_HTTP_PORT = 3050;
export const ECHO_NODE_LABEL = "echo";

/** @typedef {{ nodeId: string, mirageHost: string, mirageHttpPort: number, wsHost: string, wsPort: number, captureToken: string }} SatelliteCredentials */

/**
 * @param {import('electron').App} app
 */
export function credentialsPath(app) {
  return path.join(app.getPath("userData"), "satellite-credentials.json");
}

/**
 * @param {import('electron').App} app
 * @returns {Promise<import('./config.mjs').SatelliteCredentials | null>}
 */
export async function loadCredentials(app) {
  try {
    const raw = await fs.readFile(credentialsPath(app), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {import('electron').App} app
 * @param {import('./config.mjs').SatelliteCredentials} creds
 */
export async function saveCredentials(app, creds) {
  await fs.mkdir(path.dirname(credentialsPath(app)), { recursive: true });
  await fs.writeFile(credentialsPath(app), JSON.stringify(creds, null, 2), "utf8");
}

/** @param {import('electron').App} app */
export async function clearCredentials(app) {
  try {
    await fs.unlink(credentialsPath(app));
  } catch {
    /* missing file is fine */
  }
}

/** @param {import('electron').App} app */
export async function getOrCreateNodeId(app) {
  const existing = await loadCredentials(app);
  if (existing?.nodeId) return existing.nodeId;
  return randomUUID();
}
