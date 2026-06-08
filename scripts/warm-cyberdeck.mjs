/**
 * Pre-compiles /cyberdeck (HTML + linked client chunks) before Electron opens,
 * so the first load does not race the dev bundler and blow the Node stack.
 */
import fs from 'node:fs/promises';
import { cyberdeckRouteUrl, devStatePath, resolveDevOrigin } from './resolve-dev-origin.mjs';

const DEADLINE_MS = 300_000;
const FETCH_MS = 120_000;
const RETRY_MS = 2_000;
/** Let webpack finish writing before Electron opens a second browser session. */
const SETTLE_MS = 4_000;

/** @param {string} url @param {RequestInit} [init] */
async function fetchWithDeadline(url, init = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ac.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml,*/*', ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** @param {string} html */
function scriptSrcsFromHtml(html) {
  const srcs = new Set();
  for (const match of html.matchAll(/\ssrc="(\/_next\/static\/[^"]+\.js)"/g)) {
    srcs.add(match[1]);
  }
  return [...srcs];
}

/** @param {string} origin */
async function wakeRouteDiscovery(origin) {
  try {
    await fetchWithDeadline(`${origin}/`, { redirect: 'follow' });
  } catch {
    /* best-effort — root redirect triggers app-router compile */
  }
}

async function waitForSidecarReady() {
  let readyPort;
  try {
    const state = JSON.parse(await fs.readFile(devStatePath, 'utf8'));
    readyPort = Number(state?.readyPort);
  } catch {
    return;
  }
  if (!Number.isFinite(readyPort)) return;

  const healthUrl = `http://127.0.0.1:${readyPort}/health`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      /* Next still booting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function warmCyberdeck() {
  const origin = await resolveDevOrigin();
  process.stdout.write(`[warm] waiting for sidecar before compile (${origin})...\n`);
  await waitForSidecarReady();

  const deadline = Date.now() + DEADLINE_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    const route = cyberdeckRouteUrl(origin);

    try {
      if (attempt === 1 || attempt % 5 === 0) {
        process.stdout.write(`[warm] compiling ${route} (attempt ${attempt})...\n`);
      }

      if (attempt === 5 || attempt === 20) {
        process.stdout.write('[warm] nudging route discovery via GET /\n');
        await wakeRouteDiscovery(origin);
      }

      if (attempt === 20) {
        process.stderr.write(
          '[warm] /cyberdeck still missing — stale dev cache? try: pnpm dev:reset, delete .next and .next-dev, restart electron:dev\n',
        );
      }

      const res = await fetchWithDeadline(route);
      if (!res.ok) {
        process.stdout.write(`[warm] /cyberdeck HTTP ${res.status} - retrying\n`);
        await new Promise((r) => setTimeout(r, RETRY_MS));
        continue;
      }

      const html = await res.text();
      const scripts = scriptSrcsFromHtml(html);
      process.stdout.write(`[warm] page ok - prefetching ${scripts.length} client chunk(s)\n`);

      for (const src of scripts) {
        const chunkRes = await fetchWithDeadline(`${origin}${src}`);
        if (!chunkRes.ok) {
          throw new Error(`chunk ${src} HTTP ${chunkRes.status}`);
        }
        await chunkRes.arrayBuffer();
      }

      process.stdout.write('[warm] /cyberdeck ready - compiling chat + observation APIs\n');

      try {
        const chatWarm = await fetchWithDeadline(`${origin}/api/cyberdeck-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ warm: true }),
        });
        if (chatWarm.ok) {
          process.stdout.write('[warm] chat API ready\n');
        } else {
          process.stdout.write(`[warm] chat API HTTP ${chatWarm.status} (continuing)\n`);
        }
      } catch {
        process.stdout.write('[warm] chat API warm skipped (continuing)\n');
      }

      try {
        const obsWarm = await fetchWithDeadline(`${origin}/api/muthur/observation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshot: { route: '/cyberdeck', surface: 'cyberdeck', observing: false },
          }),
        });
        if (obsWarm.ok) {
          process.stdout.write('[warm] observation API ready - opening Electron\n');
        } else {
          process.stdout.write(`[warm] observation API HTTP ${obsWarm.status} (continuing)\n`);
        }
      } catch {
        process.stdout.write('[warm] observation API warm skipped (continuing)\n');
      }

      if (SETTLE_MS > 0) {
        process.stdout.write(`[warm] settling ${SETTLE_MS / 1000}s before Electron...\n`);
        await new Promise((r) => setTimeout(r, SETTLE_MS));
      }
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`[warm] ${msg || 'fetch failed'} - retrying\n`);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }

  process.stderr.write('[warm] timed out waiting for /cyberdeck compile\n');
  process.stderr.write(
    '[warm] fix: pnpm dev:reset && Remove-Item -Recurse -Force .next,.next-dev -ErrorAction SilentlyContinue && pnpm electron:dev\n',
  );
  process.exit(1);
}

await warmCyberdeck();
