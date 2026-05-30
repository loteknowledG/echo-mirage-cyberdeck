/**
 * Pre-compiles /cyberdeck (HTML + linked client chunks) before Electron opens,
 * so the first load does not race the dev bundler and blow the Node stack.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const devStatePath = path.join(root, '.tmp', 'dev-server.json');
const DEFAULT_ORIGIN = 'http://127.0.0.1:3050';
const DEADLINE_MS = 300_000;
const FETCH_MS = 120_000;
const RETRY_MS = 2_000;
/** Let webpack finish writing before Electron opens a second browser session. */
const SETTLE_MS = 4_000;

async function resolveOrigin() {
  if (process.env.ECHO_MIRAGE_DEV_ORIGIN) {
    return process.env.ECHO_MIRAGE_DEV_ORIGIN;
  }

  try {
    const state = JSON.parse(await fs.readFile(devStatePath, 'utf8'));
    if (state?.origin) return String(state.origin);
    if (state?.appPort) return `http://127.0.0.1:${state.appPort}`;
  } catch {
    /* fixed-port dev may not have written state yet */
  }

  return DEFAULT_ORIGIN;
}

/** @param {string} url */
async function fetchWithDeadline(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    return await fetch(url, {
      signal: ac.signal,
      headers: { Accept: '*/*' },
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

async function warmCyberdeck() {
  const origin = await resolveOrigin();
  const route = `${origin}/cyberdeck`;
  const deadline = Date.now() + DEADLINE_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      process.stdout.write(`[warm] compiling ${route} (attempt ${attempt})...\n`);
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

      process.stdout.write('[warm] /cyberdeck ready - compiling chat API\n');

      try {
        const chatWarm = await fetchWithDeadline(`${origin}/api/cyberdeck-chat`);
        if (chatWarm.ok) {
          process.stdout.write('[warm] chat API ready - opening Electron\n');
        } else {
          process.stdout.write(`[warm] chat API HTTP ${chatWarm.status} (continuing)\n`);
        }
      } catch {
        process.stdout.write('[warm] chat API warm skipped (continuing)\n');
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
  process.exit(1);
}

await warmCyberdeck();
