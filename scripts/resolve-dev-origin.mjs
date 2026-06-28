import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const devStatePath = path.join(root, '.tmp', 'dev-server.json');
export const DEFAULT_DEV_ORIGIN = 'http://127.0.0.1:3050';

/** Cold /cyberdeck compile can exceed 2 min after cache clear — keep fetches alive. */
export const DEV_ROUTE_FETCH_MS =
  Number(process.env.ECHO_MIRAGE_DEV_ROUTE_FETCH_MS) || 600_000;

/** Total Electron startup budget (sidecar + route compile + warm). */
export const DEV_STARTUP_DEADLINE_MS =
  Number(process.env.ECHO_MIRAGE_DEV_STARTUP_DEADLINE_MS) || 900_000;

export const DEV_STARTUP_HEARTBEAT_MS = 15_000;

/** Read the live dev origin from .tmp/dev-server.json (auto-port aware). */
export async function resolveDevOrigin() {
  if (process.env.ECHO_MIRAGE_DEV_ORIGIN) {
    return String(process.env.ECHO_MIRAGE_DEV_ORIGIN);
  }

  try {
    const state = JSON.parse(await fs.readFile(devStatePath, 'utf8'));
    if (state?.origin) return String(state.origin);
    if (state?.appPort) return `http://127.0.0.1:${state.appPort}`;
  } catch {
    /* dev-server.json may not exist yet */
  }

  return DEFAULT_DEV_ORIGIN;
}

/** @param {string} origin */
export function cyberdeckRouteUrl(origin) {
  return `${origin.replace(/\/$/, '')}/cyberdeck`;
}
