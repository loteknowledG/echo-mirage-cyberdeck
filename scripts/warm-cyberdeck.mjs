/**
 * Pre-compiles /cyberdeck (HTML + linked client chunks) before Electron opens,
 * so the first load does not race the dev bundler and blow the Node stack.
 */
const ORIGIN = 'http://127.0.0.1:3050';
const ROUTE = `${ORIGIN}/cyberdeck`;
const DEADLINE_MS = 300_000;
const FETCH_MS = 120_000;
const RETRY_MS = 2_000;

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
  const deadline = Date.now() + DEADLINE_MS;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      process.stdout.write(`[warm] compiling /cyberdeck (attempt ${attempt})…\n`);
      const res = await fetchWithDeadline(ROUTE);
      if (!res.ok) {
        process.stdout.write(`[warm] /cyberdeck HTTP ${res.status} — retrying\n`);
        await new Promise((r) => setTimeout(r, RETRY_MS));
        continue;
      }

      const html = await res.text();
      const scripts = scriptSrcsFromHtml(html);
      process.stdout.write(`[warm] page ok — prefetching ${scripts.length} client chunk(s)\n`);

      for (const src of scripts) {
        const chunkRes = await fetchWithDeadline(`${ORIGIN}${src}`);
        if (!chunkRes.ok) {
          throw new Error(`chunk ${src} HTTP ${chunkRes.status}`);
        }
        await chunkRes.arrayBuffer();
      }

      process.stdout.write('[warm] /cyberdeck ready — opening Electron\n');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`[warm] ${msg || 'fetch failed'} — retrying\n`);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }

  process.stderr.write('[warm] timed out waiting for /cyberdeck compile\n');
  process.exit(1);
}

await warmCyberdeck();
