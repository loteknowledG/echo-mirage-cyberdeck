/**
 * Runs `next dev` and rewrites printed origin URLs so terminal links open /cyberdeck.
 * Exposes a zero-Next readiness probe so wait-on/Electron do not compile routes.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const devStateDir = path.join(root, '.tmp');
const devStatePath = path.join(devStateDir, 'dev-server.json');
const DEFAULT_APP_PORT = 3050;
const DEFAULT_READY_PORT = 3051;
const MAX_AUTO_PORT = 3099;
// Cap V8 heap so dev + Electron + OS fit on ~16GB machines (16384 caused OS OOM / ArrayBuffer failures).
const HEAP_MB = Number(process.env.CYBERDECK_DEV_HEAP_MB) || 6144;

function devNodeEnv() {
  const env = { ...process.env };
  const heapFlag = `--max-old-space-size=${HEAP_MB}`;
  const existing = (env.NODE_OPTIONS || '').trim();
  const stripped = existing.replace(/--max-old-space-size=\S+/g, '').trim();
  env.NODE_OPTIONS = stripped ? `${stripped} ${heapFlag}` : heapFlag;
  return env;
}

let nextReady = false;

const useTurbopack =
  process.env.CYBERDECK_DEV_TURBOPACK === '1' || process.argv.includes('--turbopack');
const useWebpack = process.argv.includes('--webpack');
const useAutoPort = process.argv.includes('--auto-port') || process.env.CYBERDECK_DEV_AUTO_PORT === '1';
const bundler = useWebpack ? 'webpack' : useTurbopack ? 'turbopack' : 'webpack';

/** @param {number} port */
function canListen(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function choosePorts() {
  if (!useAutoPort) {
    return { appPort: DEFAULT_APP_PORT, readyPort: DEFAULT_READY_PORT };
  }

  for (let appPort = DEFAULT_APP_PORT; appPort < MAX_AUTO_PORT; appPort += 2) {
    const readyPort = appPort + 1;
    if ((await canListen(appPort)) && (await canListen(readyPort))) {
      return { appPort, readyPort };
    }
  }

  throw new Error(`[dev] no free app/sidecar port pair found between ${DEFAULT_APP_PORT} and ${MAX_AUTO_PORT}`);
}

const { appPort, readyPort } = await choosePorts();
const sessionStartedAt = new Date().toISOString();
const nextDistDir =
  useAutoPort && appPort !== DEFAULT_APP_PORT ? `.next-dev/${appPort}` : '.next';

async function writeDevState(ready) {
  await fs.mkdir(devStateDir, { recursive: true });
  await fs.writeFile(
    devStatePath,
    JSON.stringify(
      {
        appPort,
        readyPort,
        origin: `http://127.0.0.1:${appPort}`,
        route: `http://127.0.0.1:${appPort}/cyberdeck`,
        pid: process.pid,
        mode: useAutoPort ? 'auto' : 'fixed',
        ready,
        startedAt: sessionStartedAt,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
}

try {
  await fs.unlink(devStatePath);
} catch {
  /* no previous session file */
}
await writeDevState(false);

async function ensureDevDistDir() {
  const distRoot = path.join(root, nextDistDir);
  const devManifestPath = path.join(distRoot, 'dev', 'routes-manifest.json');
  const productionBuildIdPath = path.join(distRoot, 'BUILD_ID');

  let devManifestExists = false;
  try {
    await fs.access(devManifestPath);
    devManifestExists = true;
  } catch {
    devManifestExists = false;
  }

  if (devManifestExists) return;

  let productionBuildExists = false;
  try {
    await fs.access(productionBuildIdPath);
    productionBuildExists = true;
  } catch {
    productionBuildExists = false;
  }

  if (!productionBuildExists) return;

  process.stderr.write(
    `[dev] stale production cache at ${nextDistDir} — clearing before dev startup\n`,
  );
  await fs.rm(distRoot, { recursive: true, force: true });
}

await ensureDevDistDir();

const nextEnvPath = path.join(root, 'next-env.d.ts');
const tsconfigPath = path.join(root, 'tsconfig.json');

async function normalizeGeneratedTypePaths() {
  if (nextDistDir === '.next') return;

  try {
    const nextEnv = await fs.readFile(nextEnvPath, 'utf8');
    const normalized = nextEnv.replace(
      /import "\.\/\.next-dev\/\d+\/dev\/types\/routes\.d\.ts";/,
      'import "./.next/dev/types/routes.d.ts";',
    );
    if (normalized !== nextEnv) await fs.writeFile(nextEnvPath, normalized, 'utf8');
  } catch {
    /* Next may not have generated next-env.d.ts yet. */
  }

  try {
    const raw = await fs.readFile(tsconfigPath, 'utf8');
    const normalized = raw.replace(
      /,\r?\n\s*"\.next-dev\/\d+\/(?:dev\/)?types\/\*\*\/\*\.ts"/g,
      '',
    );
    if (normalized !== raw) await fs.writeFile(tsconfigPath, normalized, 'utf8');
  } catch {
    /* Keep dev startup resilient if tsconfig is absent or temporarily invalid. */
  }
}

const readyServer = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (nextReady && (url === '/health' || url === '/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('starting');
});

readyServer.on('error', (err) => {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
    process.stderr.write(
      `[dev] port ${readyPort} already in use - a previous dev session is still running.\n` +
        `[dev] run: pnpm dev:stop\n` +
        `[dev] or use: pnpm electron:dev (auto-port) or pnpm dev:stop\n`,
    );
    process.exit(1);
  }
  throw err;
});

readyServer.listen(readyPort, '127.0.0.1', async () => {
  if (bundler === 'turbopack') {
    process.stdout.write('[dev] turbopack mode - if PostCSS panics on Windows, use: pnpm dev (webpack)\n');
  }
  process.stdout.write(
    `[dev] app :${appPort}/cyberdeck | sidecar :${readyPort}/health | cache ${nextDistDir} | node heap ${HEAP_MB}MB | bundler ${bundler}\n`,
  );
});

function shutdownReadyServer() {
  nextReady = false;
  readyServer.close();
}

const DELIM = String.raw`(?=[\s\u001b\)\],]|$)`;

/** @param {string} line */
function rewritePrintedUrls(line) {
  return line
    .replace(
      new RegExp(`http://([\\w.]+):${appPort}/${DELIM}`, 'g'),
      `http://$1:${appPort}/cyberdeck`,
    )
    .replace(
      new RegExp(`http://([\\w.]+):${appPort}${DELIM}`, 'g'),
      `http://$1:${appPort}/cyberdeck`,
    );
}

/** @param {string} line */
function noteNextReady(line) {
  if (nextReady) return;
  if (/\bReady in\b/.test(line) || /✓ Ready\b/.test(line)) {
    nextReady = true;
    process.stdout.write(`[dev] Next ready - sidecar :${readyPort}/health open\n`);
    void writeDevState(true);
    void normalizeGeneratedTypePaths();
    void primePowerfistWs();
  }
}

async function primePowerfistWs() {
  if (process.env.ECHO_MIRAGE_POWERFIST_WS === '0') return;
  try {
    const res = await fetch(`http://127.0.0.1:${appPort}/api/powerfist/pairing/status`);
    if (res.ok) {
      process.stdout.write('[dev] powerfist WS primed\n');
      return;
    }
    process.stdout.write(`[dev] powerfist WS priming skipped (HTTP ${res.status})\n`);
  } catch {
    process.stdout.write('[dev] powerfist WS priming skipped (route not ready)\n');
  }
}

const nextArgs = [
  `--max-old-space-size=${HEAP_MB}`,
  nextCli,
  'dev',
  '-H',
  '0.0.0.0',
  '-p',
  String(appPort),
  ...(bundler === 'turbopack' ? [] : ['--webpack']),
];

const child = spawn(process.execPath, nextArgs, {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...devNodeEnv(),
    CYBERDECK_NEXT_DIST_DIR: nextDistDir,
  },
});

function pipeLines(stream, /** @type {NodeJS.WriteStream} */ out) {
  readline
    .createInterface({ input: stream, crlfDelay: Infinity })
    .on('line', (line) => {
      noteNextReady(line);
      out.write(rewritePrintedUrls(line) + '\n');
    });
}

pipeLines(child.stdout, process.stdout);
pipeLines(child.stderr, process.stderr);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shutdownReadyServer();
    child.kill(sig);
  });
}

child.on('close', async (code, signal) => {
  shutdownReadyServer();
  await normalizeGeneratedTypePaths();
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
