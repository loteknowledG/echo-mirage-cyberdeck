import fs from 'node:fs/promises';
import {
  cyberdeckRouteUrl,
  devStatePath,
  DEV_ROUTE_FETCH_MS,
  DEV_STARTUP_DEADLINE_MS,
  DEV_STARTUP_HEARTBEAT_MS,
} from './resolve-dev-origin.mjs';
const RETRY_MS = 1_000;
const waitStartedAt = Date.now();

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
  const started = Date.now();
  const heartbeat = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - started) / 1000);
    process.stdout.write(
      `[wait] compiling /cyberdeck — still waiting (${elapsedSec}s, first compile can take several minutes)…\n`,
    );
  }, DEV_STARTUP_HEARTBEAT_MS);

  const timer = setTimeout(() => ac.abort(), DEV_ROUTE_FETCH_MS);
  try {
    return await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
  }
}

function isFreshSession(state) {
  const updatedAt = Date.parse(String(state?.updatedAt ?? ''));
  if (!Number.isFinite(updatedAt)) return false;
  return updatedAt >= waitStartedAt - 2_000;
}

async function waitForDevServer() {
  const deadline = Date.now() + DEV_STARTUP_DEADLINE_MS;
  let lastMessage = 'waiting for dev-server.json';
  let sidecarReady = false;
  let announcedPorts = false;

  process.stdout.write(
    `[wait] startup budget ${Math.round(DEV_STARTUP_DEADLINE_MS / 60_000)} min · route fetch ${Math.round(DEV_ROUTE_FETCH_MS / 60_000)} min max\n`,
  );

  while (Date.now() < deadline) {
    try {
      const state = await readState();

      if (!isFreshSession(state)) {
        lastMessage = 'stale dev-server.json - waiting for new dev session';
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        continue;
      }

      if (!announcedPorts) {
        announcedPorts = true;
        process.stdout.write(
          `[wait] tracking app=:${state.appPort} sidecar=:${state.readyPort}\n`,
        );
      }

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
      process.stdout.write(`[wait] requesting ${routeUrl} (webpack may compile on first hit)…\n`);
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
      if (error instanceof Error && error.name === 'AbortError') {
        lastMessage = `/cyberdeck compile exceeded ${Math.round(DEV_ROUTE_FETCH_MS / 60_000)} min per attempt`;
      } else {
        lastMessage = error instanceof Error ? error.message : String(error);
      }
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
