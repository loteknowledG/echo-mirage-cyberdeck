import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cyberdeckRouteUrl, devStatePath } from './resolve-dev-origin.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEADLINE_MS = 300_000;
const RETRY_MS = 1_000;
const ROUTE_FETCH_MS = 120_000;

async function readState() {
  const raw = await fs.readFile(devStatePath, 'utf8');
  const state = JSON.parse(raw);
  if (!state?.readyPort || !state?.appPort) {
    throw new Error('dev-server.json missing appPort or readyPort');
  }
  return state;
}

/** @param {string} url */
async function fetchCyberdeckRoute(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ROUTE_FETCH_MS);
  try {
    return await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForDevServer() {
  const deadline = Date.now() + DEADLINE_MS;
  let lastMessage = 'waiting for dev-server.json';
  let sidecarReady = false;

  while (Date.now() < deadline) {
    try {
      const state = await readState();

      if (!sidecarReady) {
        const healthUrl = `http://127.0.0.1:${state.readyPort}/health`;
        const healthRes = await fetch(healthUrl);
        if (!healthRes.ok) {
          lastMessage = `${healthUrl} HTTP ${healthRes.status}`;
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
          continue;
        }

        sidecarReady = true;
        process.stdout.write(
          `[wait] sidecar ready app=:${state.appPort} sidecar=:${state.readyPort}\n`,
        );
      }

      const routeUrl = cyberdeckRouteUrl(`http://127.0.0.1:${state.appPort}`);
      const routeRes = await fetchCyberdeckRoute(routeUrl);
      if (routeRes.ok) {
        process.stdout.write(`[wait] /cyberdeck route ready (${routeUrl})\n`);
        return;
      }

      lastMessage = `${routeUrl} HTTP ${routeRes.status}`;
      if (routeRes.status === 404) {
        process.stdout.write(`[wait] /cyberdeck HTTP 404 - compiling or stale cache; retrying\n`);
      }
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }

  process.stderr.write(`[wait] timed out: ${lastMessage}\n`);
  process.stderr.write(
    '[wait] try: pnpm dev:reset && Remove-Item -Recurse -Force .next,.next-dev -ErrorAction SilentlyContinue && pnpm electron:dev\n',
  );
  process.exit(1);
}

await waitForDevServer();
